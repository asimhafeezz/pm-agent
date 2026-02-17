from __future__ import annotations

from typing import Any, Dict, List, Optional

import asyncio
import httpx

from app.config import get_settings


class TavilyClient:
    """Client for Tavily web search API used in deep analysis mode."""

    def __init__(self, api_key: Optional[str] = None) -> None:
        settings = get_settings()
        self.api_key = api_key or settings.tavily_api_key
        self.max_queries = settings.tavily_max_queries
        self.search_depth = settings.tavily_search_depth
        self._client = httpx.AsyncClient(
            base_url='https://api.tavily.com',
            timeout=15.0,
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def search(
        self,
        query: str,
        max_results: int = 5,
        search_depth: Optional[str] = None,
        include_answer: bool = True,
    ) -> Dict[str, Any]:
        """Execute a single Tavily search."""
        from app.tools.resilience import with_retry

        async def _do():
            response = await self._client.post('/search', json={
                'api_key': self.api_key,
                'query': query,
                'max_results': max_results,
                'search_depth': search_depth or self.search_depth,
                'include_answer': include_answer,
                'include_raw_content': False,
            })
            response.raise_for_status()
            return response.json()

        return await with_retry(_do, max_retries=1, base_delay=1.0)

    async def batch_search(
        self,
        queries: List[str],
        max_results: int = 3,
    ) -> List[Dict[str, Any]]:
        """Execute multiple searches in parallel, respecting max_queries limit."""
        limited = queries[:self.max_queries]
        tasks = [self.search(q, max_results=max_results) for q in limited]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        output: List[Dict[str, Any]] = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                output.append({
                    'query': limited[i],
                    'results': [],
                    'answer': None,
                    'error': str(result),
                })
            else:
                output.append({
                    'query': limited[i],
                    'results': result.get('results', []),
                    'answer': result.get('answer'),
                })
        return output
