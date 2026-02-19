from __future__ import annotations

from functools import lru_cache

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:  # pragma: no cover - fallback for older pydantic
    from pydantic import BaseSettings  # type: ignore

    class SettingsConfigDict(dict):
        pass


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        extra='ignore',
    )

    agent_env: str = 'local'
    agent_host: str = '0.0.0.0'
    agent_port: int = 8000
    log_level: str = 'info'

    # LLM settings
    llm_provider: str = 'groq'  # groq | openai
    groq_api_key: str = ''
    groq_model: str = 'openai/gpt-oss-120b'
    openai_api_key: str = ''
    openai_model: str = 'gpt-4o'

    # API service
    app_api_base_url: str = 'http://localhost:3000/api'
    app_api_timeout_seconds: float = 10.0
    integration_base_url: str = 'http://localhost:6001/integration'
    internal_api_key: str = 'dev-internal-key'

    # Mem0 / pgvector / Ollama settings
    pg_host: str = 'localhost'
    pg_port: int = 5433
    pg_user: str = 'postgres'
    pg_password: str = 'postgres'
    pg_db: str = 'pm_agent'

    ollama_base_url: str = 'http://localhost:11434'
    ollama_embed_model: str = 'nomic-embed-text'
    ollama_embed_dims: int = 768

    # MinIO / S3 file storage
    minio_endpoint: str = 'localhost'
    minio_port: int = 9001
    minio_access_key: str = 'minioadmin'
    minio_secret_key: str = 'minioadmin'
    minio_bucket: str = 'agentpm'
    minio_use_ssl: bool = False

    # Tavily web search (optional)
    tavily_api_key: str = ''
    tavily_max_queries: int = 5
    tavily_search_depth: str = 'advanced'


@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    return AppSettings()
