from __future__ import annotations

from typing import List

import httpx

from app.config import get_settings


class EmbeddingClient:
    """Generates text embeddings via Ollama (nomic-embed-text)."""

    def __init__(self, base_url: str | None = None, model: str | None = None) -> None:
        settings = get_settings()
        self.base_url = base_url or settings.ollama_base_url
        self.model = model or settings.ollama_embed_model
        self.dims = settings.ollama_embed_dims
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=60.0)

    async def close(self) -> None:
        await self._client.aclose()

    async def embed(self, text: str) -> List[float]:
        """Generate embedding for a single text."""
        response = await self._client.post('/api/embed', json={
            'model': self.model,
            'input': text,
        })
        response.raise_for_status()
        data = response.json()
        # Ollama returns {"embeddings": [[...]]}
        embeddings = data.get('embeddings', [])
        if embeddings:
            return embeddings[0]
        return []

    async def embed_batch(self, texts: List[str], batch_size: int = 10) -> List[List[float]]:
        """Generate embeddings for multiple texts in batches."""
        results: List[List[float]] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            response = await self._client.post('/api/embed', json={
                'model': self.model,
                'input': batch,
            })
            response.raise_for_status()
            data = response.json()
            embeddings = data.get('embeddings', [])
            results.extend(embeddings)
        return results
