from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.tools import AppApiClient

logger = logging.getLogger(__name__)


class IntegrationClient:
    """HTTP client for accessing integrations (Gmail, Linear) via the API proxy."""

    def __init__(self, api_client: AppApiClient) -> None:
        self.api = api_client

    async def get_activity_stream(
        self,
        project_id: Optional[str] = None,
        source: Optional[str] = None,
        limit: int = 20,
        auth_token: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch recent activity events from the Activity Stream."""
        params = []
        if project_id:
            params.append(f'projectId={project_id}')
        if source:
            params.append(f'source={source}')
        params.append(f'limit={limit}')
        query = '&'.join(params)

        try:
            result = await self.api.get(
                f'/activity?{query}',
                auth_token=auth_token,
            )
            if isinstance(result, dict):
                return result.get('events', [])
            return []
        except Exception as exc:
            logger.warning(f'Failed to fetch activity stream: {exc}')
            return []

    async def search_gmail(
        self,
        query: str,
        max_results: int = 10,
        auth_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Search Gmail messages via the API communication proxy."""
        try:
            result = await self.api.get(
                f'/integrations/communication/gmail/search?query={query}&maxResults={max_results}',
                auth_token=auth_token,
            )
            return result if isinstance(result, dict) else {}
        except Exception as exc:
            logger.warning(f'Failed to search Gmail: {exc}')
            return {}

    async def get_gmail_thread(
        self,
        thread_id: str,
        auth_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get a Gmail thread with all messages."""
        try:
            result = await self.api.get(
                f'/integrations/communication/gmail/threads/{thread_id}',
                auth_token=auth_token,
            )
            return result if isinstance(result, dict) else {}
        except Exception as exc:
            logger.warning(f'Failed to fetch Gmail thread: {exc}')
            return {}

    async def get_linear_issues(
        self,
        team_id: Optional[str] = None,
        project_id: Optional[str] = None,
        auth_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fetch Linear issues via the API project manager proxy."""
        params = []
        if team_id:
            params.append(f'teamId={team_id}')
        if project_id:
            params.append(f'projectId={project_id}')
        query = f'?{"&".join(params)}' if params else ''

        try:
            result = await self.api.get(
                f'/integrations/linear/issues{query}',
                auth_token=auth_token,
            )
            return result if isinstance(result, dict) else {}
        except Exception as exc:
            logger.warning(f'Failed to fetch Linear issues: {exc}')
            return {}

    async def get_meetings(
        self,
        project_id: str,
        auth_token: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch recent meetings with insights for a project."""
        try:
            result = await self.api.get(
                f'/projects/{project_id}/meetings',
                auth_token=auth_token,
            )
            if isinstance(result, list):
                return result
            return []
        except Exception as exc:
            logger.warning(f'Failed to fetch meetings: {exc}')
            return []

    async def get_linear_sync_summary(
        self,
        team_id: Optional[str] = None,
        project_id: Optional[str] = None,
        auth_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fetch Linear sprint sync summary."""
        params = []
        if team_id:
            params.append(f'teamId={team_id}')
        if project_id:
            params.append(f'projectId={project_id}')
        query = f'?{"&".join(params)}' if params else ''

        try:
            result = await self.api.get(
                f'/integrations/linear/sync-summary{query}',
                auth_token=auth_token,
            )
            return result if isinstance(result, dict) else {}
        except Exception as exc:
            logger.warning(f'Failed to fetch Linear sync summary: {exc}')
            return {}
