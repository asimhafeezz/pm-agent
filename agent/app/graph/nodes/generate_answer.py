from __future__ import annotations

from typing import Any, Dict
from app.graph.services import GraphServices
from app.graph.state import AgentState
from app.graph.nodes.common import emit_event

SYSTEM_PROMPT = "You are a helpful PM Agent. Answer the user's questions concisely."

def generate_answer_node(services: GraphServices):
    async def _node(state: AgentState) -> Dict[str, Any]:
        question = state.get('question', '')
        history = state.get('conversationHistory', [])
        
        # Construct user message with history
        user_message = ""
        for msg in history[-5:]:
            if isinstance(msg, dict):
                role = msg.get("role", "user")
                content = msg.get("content", "")
                user_message += f"{role}: {content}\n"
        
        user_message += f"user: {question}"

        response = await services.llm_client.chat(
            system=SYSTEM_PROMPT,
            user=user_message,
            temperature=0.7,
        )
        
        answer = response.get('content', 'I am sorry, I cannot answer that right now.')
        
        await emit_event(services, state, 'text_token', {'token': answer, 'done': True})

        return {
            'answer': answer,
        }
    return _node
