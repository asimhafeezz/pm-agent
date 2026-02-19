from __future__ import annotations

from typing import Any, Dict, Optional

from app.tools.llm.factory import create_llm_provider


class LlmClient:
    """Backward-compatible wrapper that delegates to a pluggable LLM provider."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None) -> None:
        self._provider = create_llm_provider(api_key=api_key, model=model)
        self.model = getattr(self._provider, 'model', model)

    async def close(self) -> None:
        await self._provider.close()

    async def chat(
        self,
        system: str,
        user: str,
        temperature: float = 0.2,
        max_tokens: int = 8192,
    ) -> Dict[str, Any]:
        return await self._provider.chat(
            system=system,
            user=user,
            temperature=temperature,
            max_tokens=max_tokens,
        )
