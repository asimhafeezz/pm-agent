from __future__ import annotations

import asyncio
from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder

from app.observability import RunEventBus
from app.config import get_settings
from app.graph import GraphServices, build_graph

from uuid import uuid4

router = APIRouter()


async def get_event_bus(request: Request) -> RunEventBus:
    return request.app.state.event_bus


def build_initial_state(payload: dict, auth_token: str) -> dict:
    # Support new 2-axis mode system with backward compatibility
    execution_mode = payload.get('executionMode')
    deep_analysis = payload.get('deepAnalysis')

    # Backward compatibility: map legacy 'mode' to new structure
    if execution_mode is None and 'mode' in payload:
        legacy_mode = payload.get('mode', 'quick')
        if legacy_mode == 'deep':
            execution_mode = 'quick'
            deep_analysis = True
        elif legacy_mode == 'thinking':
            execution_mode = 'thinking'
            deep_analysis = False
        else:
            execution_mode = 'quick'
            deep_analysis = False

    # Default values
    if execution_mode is None:
        execution_mode = 'quick'
    if deep_analysis is None:
        deep_analysis = False

    return {
        'runId': payload.get('runId') or str(uuid4()),
        'question': payload.get('question', ''),
        'userContext': payload.get('userContext'),
        'executionMode': execution_mode,
        'deepAnalysis': deep_analysis,
        'metadata': {
            'symbols': payload.get('symbols') or [],
            'runConfig': payload.get('runConfig') or {},
            'conversationId': payload.get('conversationId'),
            'userId': payload.get('userId'),
            'generateTitle': payload.get('generateTitle', False),
            'skipRunPersistence': False,
            'executionMode': execution_mode,
            'deepAnalysis': deep_analysis,
        },
        'toolCallCount': 0,
        'warnings': [],
        'authToken': auth_token,
    }


@router.websocket('/agent/stream')
async def stream_agent(websocket: WebSocket) -> None:
    await websocket.accept()
    run_id = websocket.query_params.get('runId')
    if not run_id:
        await websocket.send_json({'error': 'runId is required'})
        await websocket.close()
        return

    event_bus: RunEventBus = websocket.app.state.event_bus
    queue = event_bus.get_queue(run_id)

    try:
        while True:
            event = await queue.get()
            await websocket.send_json(jsonable_encoder(event.model_dump(by_alias=True)))
            if event.event == 'completed':
                break
    except WebSocketDisconnect:
        return
    finally:
        event_bus.close(run_id)
        await websocket.close()


@router.websocket('/agent/chat')
async def chat_agent(websocket: WebSocket) -> None:
    await websocket.accept()

    services: GraphServices = websocket.app.state.graph_services
    event_bus: RunEventBus = websocket.app.state.event_bus

    try:
        payload = await websocket.receive_json()
    except Exception:
        await websocket.send_json({'error': 'Invalid payload'})
        await websocket.close()
        return

    auth_token = payload.get('authToken') or websocket.query_params.get('authToken', '')
    initial_state = build_initial_state(payload, auth_token)
    conversation_id = initial_state.get('metadata', {}).get('conversationId')

    # Load full user context and conversation history for multi-turn
    if auth_token:
        try:
            user_context = await services.app_api_client.get_user_context(conversation_id, auth_token)
            if user_context:
                initial_state['userContext'] = user_context
                print(f"[INFO] Loaded user context for conversation {conversation_id}")
            else:
                print(f"[WARNING] get_user_context returned empty for conversation {conversation_id}")
        except Exception as exc:
            print(f"[ERROR] Failed to load user context for conversation {conversation_id}: {exc}")

        if conversation_id:
            try:
                messages = await services.app_api_client.get_conversation_messages(
                    conversation_id, limit=10, auth_token=auth_token,
                )
                if messages:
                    initial_state['conversationHistory'] = messages
            except Exception as exc:
                print(f"[ERROR] Failed to load conversation messages for {conversation_id}: {exc}")

    execution_mode = initial_state.get('executionMode', 'quick')
    deep_analysis = initial_state.get('deepAnalysis', False)

    # Create agent run record in the API for audit/persistence
    if auth_token and conversation_id:
        try:
            run_record = await services.app_api_client.create_run(
                conversation_id=conversation_id,
                execution_mode=execution_mode,
                deep_analysis=deep_analysis,
                symbols=initial_state.get('metadata', {}).get('symbols', []),
                config=initial_state.get('metadata', {}).get('runConfig', {}),
                auth_token=auth_token,
            )
            # Use the API-generated run ID so events/tool calls attach correctly
            if run_record and run_record.get('id'):
                initial_state['runId'] = run_record['id']
                initial_state['metadata']['runId'] = run_record['id']
        except Exception as exc:
            print(f"[WARNING] Failed to create agent run: {exc}")
            # Continue anyway — persistence is best-effort, not blocking

    run_id = initial_state['runId']
    queue = event_bus.get_queue(run_id)

    async def _run_graph() -> None:
        try:
            # Build graph for the requested mode combination
            graph = build_graph(services, execution_mode, deep_analysis)

            if deep_analysis:
                settings = get_settings()
                timeout = settings.deep_analysis_timeout_seconds
            elif execution_mode == 'thinking':
                timeout = 120.0
            else:
                timeout = 90.0

            final_state = await asyncio.wait_for(graph.ainvoke(initial_state), timeout=timeout)

            # Persist run completion with final results
            if auth_token and not initial_state.get('metadata', {}).get('skipRunPersistence'):
                try:
                    await services.app_api_client.complete_run(
                        run_id=run_id,
                        final_answer_text=final_state.get('finalAnswer', ''),
                        decision_json=final_state.get('decision'),
                        confidence=final_state.get('decision', {}).get('confidence') if final_state.get('decision') else None,
                        summary=None,
                        model_info={'provider': 'groq', 'model': services.llm_client.model},
                        warnings=final_state.get('warnings'),
                        auth_token=auth_token,
                    )
                except Exception:
                    pass
        except asyncio.TimeoutError:
            print(f"[ERROR] Graph execution timed out for run {run_id}")
            await event_bus.emit(run_id, 'completed', {
                'finalAnswer': "Sorry, the request took too long. Please try again.",
                'error': 'timeout',
            })
        except Exception as exc:
            import traceback
            error_msg = f"Graph execution error: {exc}\n{traceback.format_exc()}"
            print(f"[ERROR] {error_msg}")
            await event_bus.emit(run_id, 'completed', {
                'finalAnswer': f"Sorry, I encountered an error: {exc}",
                'error': str(exc),
            })
    await event_bus.emit(run_id, 'started', {
        'executionMode': execution_mode,
        'deepAnalysis': deep_analysis,
    })
    if deep_analysis:
        await event_bus.emit(run_id, 'deep_started', {'estimatedSteps': 5})
    task = asyncio.create_task(_run_graph())

    try:
        while True:
            event = await queue.get()
            await websocket.send_json(jsonable_encoder(event.model_dump(by_alias=True)))
            if event.event == 'completed':
                break
    except WebSocketDisconnect:
        return
    finally:
        task.cancel()
        event_bus.close(run_id)
        await websocket.close()

