from __future__ import annotations

from functools import lru_cache

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:  # pragma: no cover - fallback for older pydantic
    from pydantic import BaseSettings  # type: ignore

    class SettingsConfigDict(dict):
        pass


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8')

    agent_env: str = 'local'
    agent_host: str = '0.0.0.0'
    agent_port: int = 8000
    log_level: str = 'info'

    integration_base_url: str = 'http://localhost:3001/integration'
    integration_timeout_seconds: float = 10.0

    groq_api_key: str = ''
    groq_model: str = 'openai/gpt-oss-120b'

    app_api_base_url: str = 'http://localhost:3000/api'
    app_api_timeout_seconds: float = 10.0

    # Mem0 / pgvector / Ollama settings
    pg_host: str = 'localhost'
    pg_port: int = 5433
    pg_user: str = 'postgres'
    pg_password: str = 'postgres'
    pg_db: str = 'pm_agent'
    
    ollama_base_url: str = 'http://localhost:11434'
    ollama_embed_model: str = 'nomic-embed-text'
    ollama_embed_dims: int = 768

    # Tavily web search (deep analysis)
    tavily_api_key: str = ''
    tavily_max_queries: int = 5
    tavily_search_depth: str = 'advanced'  # 'basic' or 'advanced'

    # Deep analysis settings
    deep_analysis_timeout_seconds: float = 180.0
    deep_analysis_max_news_per_symbol: int = 15

    # SAFETY_BUDGETS (MVP - comments only, not enforced yet)
    # max_tool_calls: int = 12
    # max_news_articles_per_symbol: int = 20
    # tool_timeout_seconds: int = 10


@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    return AppSettings()
