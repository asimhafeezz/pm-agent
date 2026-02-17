from __future__ import annotations

from typing import Any, Dict, Optional

import httpx

from app.config import get_settings


class IntegrationClient:
    def __init__(self, base_url: Optional[str] = None, timeout_seconds: Optional[float] = None) -> None:
        settings = get_settings()
        self.base_url = base_url or settings.integration_base_url
        self.timeout_seconds = timeout_seconds or settings.integration_timeout_seconds
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout_seconds)

    async def close(self) -> None:
        await self._client.aclose()

    async def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        from app.tools.resilience import with_retry

        async def _do():
            response = await self._client.get(path, params=params)
            response.raise_for_status()
            return response.json()

        return await with_retry(_do, max_retries=2, base_delay=0.5)

    async def search_symbols(self, query: str, exchange: str | None = None, country: str | None = None) -> Dict[str, Any]:
        return await self.get('/tools/market-prices/search-symbols', {
            'query': query,
            'exchange': exchange,
            'country': country,
        })

    async def batch_quote(self, symbols: list[str], interval: str | None = None, outputsize: int | None = None,
                          start_date: str | None = None, end_date: str | None = None) -> Dict[str, Any]:
        return await self.get('/tools/market-prices/batch-quote', {
            'symbols': ','.join(symbols),
            'interval': interval,
            'outputsize': outputsize,
            'start_date': start_date,
            'end_date': end_date,
        })

    async def time_series(self, symbol: str, interval: str | None = None, range: str | None = None,
                          outputsize: int | None = None,
                          start_date: str | None = None, end_date: str | None = None) -> Dict[str, Any]:
        return await self.get('/tools/market-prices/time-series', {
            'symbol': symbol,
            'interval': interval,
            'range': range,
            'outputsize': outputsize,
            'start_date': start_date,
            'end_date': end_date,
        })

    async def fundamentals(self, symbol: str) -> Dict[str, Any]:
        return await self.get('/tools/market-data/fundamentals', {'symbol': symbol})

    async def earnings(self, symbol: str) -> Dict[str, Any]:
        return await self.get('/tools/market-data/earnings', {'symbol': symbol})

    async def earnings_calendar(self, start_date: str | None = None, end_date: str | None = None) -> Dict[str, Any]:
        return await self.get('/tools/market-data/earnings-calendar', {
            'from': start_date,
            'to': end_date,
        })

    async def analyst_estimates(self, symbol: str, period: str | None = None, page: int | None = None,
                                limit: int | None = None) -> Dict[str, Any]:
        return await self.get('/tools/market-data/analyst-estimates', {
            'symbol': symbol,
            'period': period,
            'page': page,
            'limit': limit,
        })

    async def news_latest(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return await self.get('/tools/news/latest', params)

    async def news_archive(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return await self.get('/tools/news/archive', params)

    async def news_market(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return await self.get('/tools/news/market', params)
