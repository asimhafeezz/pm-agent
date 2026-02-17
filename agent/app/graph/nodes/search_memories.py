from __future__ import annotations

from typing import Any, Dict

from app.graph.services import GraphServices
from app.graph.state import AgentState


def search_memories_node(services: GraphServices):
    """Retrieve relevant semantic memories before processing."""

    async def _node(state: AgentState) -> Dict[str, Any]:
        if not services.memory_client:
            return {'relevantMemories': []}

        user_id = state.get('metadata', {}).get('userId', '')
        question = state.get('question', '')

        if not user_id or not question:
            return {'relevantMemories': []}

        try:
            memories = services.memory_client.search(
                query=question,
                user_id=user_id,
                limit=5,
            )
            return {'relevantMemories': memories}
        except Exception:
            return {'relevantMemories': []}

    return _node
