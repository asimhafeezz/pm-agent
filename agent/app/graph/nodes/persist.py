from __future__ import annotations

from typing import Any, Dict

from app.graph.services import GraphServices
from app.graph.nodes.common import emit_event
from app.graph.state import AgentState


def persist_node(services: GraphServices):
    async def _node(state: AgentState) -> Dict[str, Any]:
        payload = {
            'finalAnswer': state.get('finalAnswer'),
            'conversationTitle': state.get('conversationTitle'),
            'warnings': state.get('warnings') or [],
        }

        await emit_event(services, state, 'completed', payload)
        return {}

    return _node
