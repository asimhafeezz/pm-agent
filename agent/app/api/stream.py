from __future__ import annotations

from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder

from app.observability import RunEventBus
from app.graph import GraphServices, build_graph

from uuid import uuid4

router = APIRouter()


async def get_event_bus(request: Request) -> RunEventBus:
    return request.app.state.event_bus


def build_initial_state(payload: dict, auth_token: str) -> dict:
    return {
        'runId': payload.get('runId') or str(uuid4()),
        'question': payload.get('question', ''),
        'userContext': payload.get('userContext'),
        'projectId': payload.get('projectId'),
        'metadata': {
            'symbols': payload.get('symbols') or [],
            'runConfig': payload.get('runConfig') or {},
            'conversationId': payload.get('conversationId'),
            'userId': payload.get('userId'),
            'generateTitle': payload.get('generateTitle', False),
            'skipRunPersistence': False,
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

    # Load conversation history for multi-turn context
    if auth_token:
        if conversation_id:
            try:
                messages = await services.app_api_client.get_conversation_messages(
                    conversation_id, limit=10, auth_token=auth_token,
                )
                if messages:
                    initial_state['conversationHistory'] = messages
            except Exception as exc:
                print(f"[ERROR] Failed to load conversation messages for {conversation_id}: {exc}")

    run_id = initial_state['runId']
    queue = event_bus.get_queue(run_id)

    async def _run_graph() -> None:
        try:
            graph = build_graph(services)
            await graph.ainvoke(initial_state)
        except Exception as exc:
            import traceback
            error_msg = f"Graph execution error: {exc}\n{traceback.format_exc()}"
            print(f"[ERROR] {error_msg}")
            await event_bus.emit(run_id, 'completed', {
                'finalAnswer': f"Sorry, I encountered an error: {exc}",
                'error': str(exc),
            })
    await event_bus.emit(run_id, 'started')
    import asyncio
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
