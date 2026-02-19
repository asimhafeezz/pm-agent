from __future__ import annotations

from typing import Optional

from app.config import get_settings
from .groq_provider import GroqProvider


def create_llm_provider(
    provider: Optional[str] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
):
    """Factory to create the configured LLM provider.

    Supports 'groq' (default). Add 'openai' by creating an OpenAIProvider
    class and adding a case here.
    """
    settings = get_settings()
    provider = provider or settings.llm_provider

    if provider == 'groq':
        return GroqProvider(
            api_key=api_key or settings.groq_api_key,
            model=model or settings.groq_model,
        )
    # elif provider == 'openai':
    #     from .openai_provider import OpenAIProvider
    #     return OpenAIProvider(
    #         api_key=api_key or settings.openai_api_key,
    #         model=model or settings.openai_model,
    #     )
    else:
        raise ValueError(f'Unknown LLM provider: {provider}')
