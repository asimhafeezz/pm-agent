from __future__ import annotations

from typing import Any, Awaitable, Callable, Dict

import time

from app.graph.services import GraphServices
from app.graph.state import AgentState


def get_run_config(state: AgentState) -> Dict[str, Any]:
    return state.get('metadata', {}).get('runConfig', {}) or {}


def can_call_tool(state: AgentState) -> bool:
    """DEPRECATED: Use acquire_tool_call() for thread-safe budget tracking."""
    config = get_run_config(state)
    max_calls = config.get('maxToolCalls')
    if max_calls is None:
        return True
    return state.get('toolCallCount', 0) < max_calls


def increment_tool_calls(state: AgentState) -> None:
    """DEPRECATED: Use acquire_tool_call() for thread-safe budget tracking."""
    state['toolCallCount'] = state.get('toolCallCount', 0) + 1


async def acquire_tool_call(services: 'GraphServices', state: AgentState) -> bool:
    """Atomically check and increment tool call budget. Returns True if allowed.

    Uses an asyncio.Lock to prevent race conditions when parallel tasks
    (via asyncio.gather) check and increment the budget concurrently.
    """
    async with services.tool_budget_lock:
        config = get_run_config(state)
        max_calls = config.get('maxToolCalls')
        if max_calls is not None and state.get('toolCallCount', 0) >= max_calls:
            return False
        state['toolCallCount'] = state.get('toolCallCount', 0) + 1
        return True


async def emit_event(services: GraphServices, state: AgentState, event: str, payload: Dict[str, Any] | None = None):
    run_id = state['runId']
    auth_token = state.get('authToken')
    await services.event_bus.emit(run_id, event, payload)
    if state.get('metadata', {}).get('skipRunPersistence'):
        return
    try:
        await services.app_api_client.create_event(run_id, event, payload or {}, auth_token)
    except Exception:
        # Do not fail the agent run if persistence fails; surface via warnings later.
        return


async def trace_tool_call(
    services: GraphServices,
    state: AgentState,
    tool_name: str,
    request_payload: Dict[str, Any],
    call: Callable[[], Awaitable[Dict[str, Any]]],
) -> Dict[str, Any]:
    run_id = state['runId']
    auth_token = state.get('authToken')
    start = time.perf_counter()
    response = await call()
    latency_ms = (time.perf_counter() - start) * 1000
    if not state.get('metadata', {}).get('skipRunPersistence'):
        try:
            await services.app_api_client.create_tool_call(
                run_id=run_id,
                tool_name=tool_name,
                request_json=request_payload,
                response_json=response,
                latency_ms=latency_ms,
                auth_token=auth_token,
            )
        except Exception:
            return response
    
    await services.event_bus.emit(run_id, 'tool_result', {
        'tool': tool_name,
        'request': request_payload,
        'result': response,
    })
    return response
