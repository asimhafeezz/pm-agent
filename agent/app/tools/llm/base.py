from __future__ import annotations

from typing import Any, Dict, Protocol, runtime_checkable


@runtime_checkable
class LlmProvider(Protocol):
    """Abstract interface for LLM providers. Implement this to add new providers."""

    async def chat(
        self,
        system: str,
        user: str,
        temperature: float = 0.2,
        max_tokens: int = 8192,
    ) -> Dict[str, Any]:
        """Send a chat completion request. Returns {'model': str, 'content': str}."""
        ...

    async def close(self) -> None:
        """Cleanup resources."""
        ...
