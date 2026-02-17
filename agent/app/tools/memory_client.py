from __future__ import annotations

from typing import Any, Dict, List, Optional

from mem0 import Memory

from app.config import get_settings


class MemoryClient:
    """Wrapper around mem0 for semantic memory storage and retrieval."""

    def __init__(self) -> None:
        settings = get_settings()
        
        config = {
            "llm": {
                "provider": "groq",
                "config": {
                    "model": "llama-3.1-8b-instant",
                    "temperature": 0.1,
                    "api_key": settings.groq_api_key,
                }
            },
            "embedder": {
                "provider": "ollama",
                "config": {
                    "model": settings.ollama_embed_model,
                    "embedding_dims": settings.ollama_embed_dims,
                    "ollama_base_url": settings.ollama_base_url,
                }
            },
            "vector_store": {
                "provider": "pgvector",
                "config": {
                    "host": settings.pg_host,
                    "port": settings.pg_port,
                    "user": settings.pg_user,
                    "password": settings.pg_password,
                    "dbname": settings.pg_db,
                    "embedding_model_dims": settings.ollama_embed_dims,
                }
            }
        }
        
        self._memory = Memory.from_config(config)

    def add(
        self,
        messages: List[Dict[str, str]],
        user_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Add memories from a conversation turn."""
        try:
            result = self._memory.add(messages, user_id=user_id, metadata=metadata or {})
            return result if result else {}
        except Exception:
            return {}

    def search(
        self,
        query: str,
        user_id: str,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """Search for relevant memories."""
        try:
            results = self._memory.search(query, user_id=user_id, limit=limit)
            return results if results else []
        except Exception:
            return []

    def get_all(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all memories for a user."""
        try:
            results = self._memory.get_all(user_id=user_id)
            return results if results else []
        except Exception:
            return []
