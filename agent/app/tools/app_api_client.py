from __future__ import annotations

from typing import Any, Dict, Optional

import httpx

from app.config import get_settings


class AppApiClient:
    def __init__(self, base_url: Optional[str] = None, timeout_seconds: Optional[float] = None) -> None:
        settings = get_settings()
        self.base_url = base_url or settings.app_api_base_url
        self.timeout_seconds = timeout_seconds or settings.app_api_timeout_seconds
        self.internal_api_key = settings.internal_api_key
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=self.timeout_seconds)

    async def close(self) -> None:
        await self._client.aclose()

    def _headers(self, auth_token: str | None) -> Dict[str, str]:
        headers: Dict[str, str] = {}
        if self.internal_api_key:
            headers['X-Internal-Api-Key'] = self.internal_api_key
        if auth_token:
            headers['Authorization'] = auth_token
        return headers

    def _unwrap(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if isinstance(payload, dict) and 'data' in payload and 'success' in payload:
            return payload.get('data') or {}
        return payload

    async def post(self, path: str, payload: Dict[str, Any], auth_token: str | None = None) -> Dict[str, Any]:
        response = await self._client.post(path, json=payload, headers=self._headers(auth_token))
        response.raise_for_status()
        return self._unwrap(response.json())

    async def get(self, path: str, auth_token: str | None = None) -> Dict[str, Any]:
        response = await self._client.get(path, headers=self._headers(auth_token))
        response.raise_for_status()
        return self._unwrap(response.json())

    async def patch(self, path: str, payload: Dict[str, Any], auth_token: str | None = None) -> Dict[str, Any]:
        response = await self._client.patch(path, json=payload, headers=self._headers(auth_token))
        response.raise_for_status()
        return self._unwrap(response.json())

    async def create_event(self, run_id: str, event_type: str, payload: Dict[str, Any], auth_token: str | None = None) -> None:
        await self.post(f'/agent-runs/{run_id}/events', {
            'type': event_type,
            'payload': payload,
        }, auth_token)

    async def create_tool_call(
        self,
        run_id: str,
        tool_name: str,
        request_json: Dict[str, Any],
        response_json: Dict[str, Any],
        latency_ms: float,
        auth_token: str | None = None,
    ) -> None:
        await self.post(f'/agent-runs/{run_id}/tool-calls', {
            'toolName': tool_name,
            'requestJson': request_json,
            'responseJson': response_json,
            'latencyMs': latency_ms,
        }, auth_token)

    async def complete_run(
        self,
        run_id: str,
        final_answer_text: str,
        decision_json: Dict[str, Any] | None,
        confidence: float | None,
        summary: str | None,
        model_info: Dict[str, Any] | None,
        warnings: list[str] | None,
        auth_token: str | None = None,
    ) -> None:
        await self.post(f'/agent-runs/{run_id}/complete', {
            'finalAnswerText': final_answer_text,
            'decisionJson': decision_json,
            'confidence': confidence,
            'summary': summary,
            'modelInfo': model_info,
            'warnings': warnings or [],
        }, auth_token)

    async def create_run(
        self,
        conversation_id: str,
        execution_mode: str = 'quick',
        deep_analysis: bool = False,
        symbols: list[str] | None = None,
        config: Dict[str, Any] | None = None,
        auth_token: str | None = None,
    ) -> Dict[str, Any]:
        """Create a new agent run record. Returns the created run (with id)."""
        return await self.post('/agent-runs', {
            'conversationId': conversation_id,
            'executionMode': execution_mode,
            'deepAnalysis': deep_analysis,
            'symbols': symbols or [],
            'config': config or {},
        }, auth_token)

    async def get_conversation_memory(self, conversation_id: str, auth_token: str | None = None) -> Dict[str, Any]:
        return await self.get(f'/conversations/{conversation_id}/memory', auth_token)

    async def upsert_conversation_memory(
        self,
        conversation_id: str,
        payload: Dict[str, Any],
        auth_token: str | None = None,
    ) -> Dict[str, Any]:
        return await self.post(f'/conversations/{conversation_id}/memory', payload, auth_token)

    async def get_user_context(
        self,
        conversation_id: str | None = None,
        auth_token: str | None = None,
    ) -> Dict[str, Any]:
        params = f'?conversationId={conversation_id}' if conversation_id else ''
        return await self.get(f'/me/context{params}', auth_token)

    async def get_conversation_messages(
        self,
        conversation_id: str,
        limit: int = 10,
        auth_token: str | None = None,
    ) -> list[Dict[str, Any]]:
        """Fetch recent messages for a conversation (most recent first)."""
        result = await self.get(
            f'/conversations/{conversation_id}/messages?limit={limit}',
            auth_token,
        )
        if isinstance(result, list):
            return result
        if isinstance(result, dict):
            return result.get('messages', result.get('data', []))
        return []
