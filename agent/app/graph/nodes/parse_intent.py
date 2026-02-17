from __future__ import annotations

from typing import Any, Dict
from app.graph.services import GraphServices
from app.graph.state import AgentState

def parse_intent_node(services: GraphServices):
    async def _node(state: AgentState) -> Dict[str, Any]:
        return {
            'intentType': 'general_chat',
            'requiredDataSources': [],
            'intent': {
                'type': 'general_chat',
                'entities': {}
            }
        }
    return _node
