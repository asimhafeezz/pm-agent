from __future__ import annotations

from typing import Any, Dict

from app.graph.services import GraphServices
from app.graph.state import AgentState


def store_memories_node(services: GraphServices):
    """Store memories from the conversation turn after response generation."""

    async def _node(state: AgentState) -> Dict[str, Any]:
        if not services.memory_client:
            return {}

        user_id = state.get('metadata', {}).get('userId', '')
        question = state.get('question', '')
        answer = state.get('finalAnswer', '')

        if not user_id or not question:
            return {}

        try:
            messages = [
                {"role": "user", "content": question},
                {"role": "assistant", "content": answer or ""},
            ]

            services.memory_client.add(
                messages=messages,
                user_id=user_id,
                metadata={
                    "conversationId": state.get('metadata', {}).get('conversationId', ''),
                }
            )
        except Exception:
            pass

        return {}

    return _node
