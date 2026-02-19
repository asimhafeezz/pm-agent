from __future__ import annotations

from typing import Any, Dict, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq

from app.config import get_settings


class GroqProvider:
    """LLM provider backed by Groq."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None) -> None:
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.groq_api_key
        self.model = model if model is not None else settings.groq_model
        if not self.api_key:
            raise RuntimeError('GROQ_API_KEY is not configured.')
        self._llm = ChatGroq(api_key=self.api_key, model=self.model)

    async def chat(
        self,
        system: str,
        user: str,
        temperature: float = 0.2,
        max_tokens: int = 8192,
    ) -> Dict[str, Any]:
        from app.tools.resilience import with_retry

        async def _do():
            response = await self._llm.ainvoke(
                [SystemMessage(content=system), HumanMessage(content=user)],
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return {
                'model': self.model,
                'content': response.content,
            }

        return await with_retry(_do, max_retries=1, base_delay=1.0)

    async def close(self) -> None:
        return None
