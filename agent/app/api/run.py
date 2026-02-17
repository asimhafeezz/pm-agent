from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, Depends, Request

from app.graph import GraphServices, build_graph
from app.schemas import RunRequest, RunResponse

router = APIRouter()


async def get_services(request: Request) -> GraphServices:
    return request.app.state.graph_services


async def execute_run(run_id: str, state: Dict[str, Any], services: GraphServices):
    graph = build_graph(services)
    final_state = await graph.ainvoke(state)
    try:
        auth_token = final_state.get('authToken')
        await services.app_api_client.complete_run(
            run_id=run_id,
            final_answer_text=final_state.get('finalAnswer') or '',
            decision_json=final_state.get('decision'),
            confidence=final_state.get('decision', {}).get('confidence') if final_state.get('decision') else None,
            summary=None,
            model_info={'provider': 'groq', 'model': services.llm_client.model},
            warnings=final_state.get('warnings'),
            auth_token=auth_token,
        )
    except Exception:
        return


def build_initial_state(payload: RunRequest) -> Dict[str, Any]:
    run_config = payload.run_config.model_dump(by_alias=True) if payload.run_config else {}
    return {
        'runId': payload.run_id,
        'question': payload.question,
        'userContext': payload.user_context,
        'metadata': {
            'symbols': payload.symbols or [],
            'runConfig': run_config,
            'conversationId': payload.conversation_id,
            'userId': payload.user_id,
            'generateTitle': False,
        },
        'toolCallCount': 0,
        'warnings': [],
    }


@router.post('/agent/run', response_model=RunResponse, response_model_by_alias=True)
async def run_agent(
    payload: RunRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    services: GraphServices = Depends(get_services),
) -> RunResponse:
    initial_state = build_initial_state(payload)
    if request:
        initial_state['authToken'] = request.headers.get('authorization', '')

    await services.event_bus.emit(payload.run_id, 'started')
    try:
        await services.app_api_client.create_event(payload.run_id, 'started', {}, initial_state.get('authToken'))
    except Exception:
        pass

    background_tasks.add_task(execute_run, payload.run_id, initial_state, services)
    return RunResponse(run_id=payload.run_id)
