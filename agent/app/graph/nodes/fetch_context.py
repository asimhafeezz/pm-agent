from __future__ import annotations

import logging
from typing import Any, Dict

from app.graph.services import GraphServices
from app.graph.state import AgentState

logger = logging.getLogger(__name__)


def fetch_context_node(services: GraphServices):
    """Fetch recent activity events and meeting context to give the agent awareness."""

    async def _node(state: AgentState) -> Dict[str, Any]:
        if not services.integration_client:
            logger.debug('Integration client not available, skipping context fetch')
            return {}

        project_id = state.get('projectId')
        auth_token = state.get('authToken')

        if not project_id:
            logger.debug('No projectId in state, skipping context fetch')
            return {}

        result: Dict[str, Any] = {}

        # Always fetch activity stream
        try:
            events = await services.integration_client.get_activity_stream(
                project_id=project_id,
                limit=15,
                auth_token=auth_token,
            )
            logger.info(f'Fetched {len(events)} activity events for context')
            result['activityContext'] = events
        except Exception as exc:
            logger.warning(f'Failed to fetch activity context: {exc}')
            result['activityContext'] = []

        # Fetch meeting context for meeting-related queries
        intent_type = state.get('intentType', 'general_chat')
        if intent_type == 'meeting_query':
            try:
                meetings = await services.integration_client.get_meetings(
                    project_id=project_id,
                    auth_token=auth_token,
                )
                # Flatten insights from recent meetings
                meeting_context = []
                for m in meetings[:5]:
                    meeting_entry = {
                        'title': m.get('title', ''),
                        'meetingDate': m.get('meetingDate'),
                        'status': m.get('status'),
                        'insights': m.get('insights', []),
                    }
                    meeting_context.append(meeting_entry)
                result['meetingContext'] = meeting_context
                logger.info(f'Fetched {len(meeting_context)} meetings for context')
            except Exception as exc:
                logger.warning(f'Failed to fetch meeting context: {exc}')
                result['meetingContext'] = []

        # Fetch risk context for risk/summary/priority/stakeholder queries
        if intent_type in ('risk_query', 'summary_query', 'priority_query', 'stakeholder_query'):
            try:
                risks = await services.app_api_client.get(
                    f'/projects/{project_id}/intelligence/risks?status=open',
                    auth_token=auth_token,
                )
                if isinstance(risks, list):
                    result['riskContext'] = risks
                    logger.info(f'Fetched {len(risks)} open risks for context')
                else:
                    result['riskContext'] = []
            except Exception as exc:
                logger.warning(f'Failed to fetch risk context: {exc}')
                result['riskContext'] = []

            # Fetch latest weekly summary for summary/stakeholder queries
            if intent_type in ('summary_query', 'stakeholder_query'):
                try:
                    summaries = await services.app_api_client.get(
                        f'/projects/{project_id}/intelligence/summaries',
                        auth_token=auth_token,
                    )
                    if isinstance(summaries, list) and summaries:
                        result['summaryContext'] = summaries[0]
                        logger.info('Fetched latest weekly summary for context')
                except Exception as exc:
                    logger.warning(f'Failed to fetch summary context: {exc}')

        return result

    return _node
