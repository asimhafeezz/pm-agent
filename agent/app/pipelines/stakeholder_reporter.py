from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from app.tools import AppApiClient, LlmClient
from app.tools.integration_client import IntegrationClient

logger = logging.getLogger(__name__)

WEEKLY_SUMMARY_PROMPT = """You are an AI PM assistant generating a comprehensive weekly project summary.

Analyze all available project data and produce a summary that includes:
1. **Executive Summary**: 2-3 sentence overview of the week
2. **Key Metrics**: Issues completed, created, blocked, velocity
3. **Highlights**: Major accomplishments and milestones
4. **Risks**: Active risks and their status
5. **Recommendations**: Suggested actions for the upcoming week

Respond with ONLY valid JSON:
{
  "executiveSummary": "This week the team completed 12 issues...",
  "metrics": {
    "issuesCompleted": 12,
    "issuesCreated": 8,
    "issuesBlocked": 2,
    "velocity": 34,
    "velocityTrend": "stable"
  },
  "highlights": [
    {"title": "Shipped user auth", "description": "Completed OAuth integration ahead of schedule"}
  ],
  "risks": [
    {"description": "Two backend engineers out next week", "severity": "medium", "mitigation": "Redistribute tasks"}
  ],
  "recommendations": [
    {"action": "Schedule design review for dashboard redesign", "priority": "high", "reason": "Sprint 5 dependency"}
  ]
}"""

STAKEHOLDER_UPDATE_PROMPT = """You are an AI PM assistant generating a stakeholder update.

Given the project data below, generate an update tailored for the specified audience.

Audience types:
- **executive**: High-level, focused on business outcomes, risks, and timelines. No technical details.
- **engineering**: Technical details, blockers, architecture decisions, and velocity metrics.
- **stakeholder**: Balanced view with feature progress, timelines, and key decisions.

Format the update as clear, professional prose suitable for email or Slack. Use bullet points for key items.

Respond with ONLY valid JSON:
{
  "subject": "Weekly Project Update - [date range]",
  "body": "The formatted update text in markdown",
  "audience": "executive",
  "keyPoints": ["point1", "point2"]
}"""

PRIORITIZATION_PROMPT = """You are an AI PM assistant performing RICE/WSJF prioritization.

Given the list of issues/features below with available context (user requests from email, meeting discussions, ticket activity, sprint goals), score each item using the RICE framework:
- **Reach**: How many users/stakeholders will this impact? (1-10)
- **Impact**: How much will this move the needle? (1-3: low/medium/high)
- **Confidence**: How sure are we about the above? (0.5-1.0)
- **Effort**: How many person-weeks? (0.5-10)
- **RICE Score**: (Reach * Impact * Confidence) / Effort

Also consider WSJF (Weighted Shortest Job First) where applicable:
- **Business Value**: Revenue/strategic impact (1-10)
- **Time Criticality**: Urgency/deadline pressure (1-10)
- **Risk Reduction**: Technical/business risk reduced (1-10)
- **Job Size**: Effort (1-10)

Respond with ONLY valid JSON:
{
  "items": [
    {
      "id": "issue-id or title",
      "title": "Feature name",
      "riceScore": 45.0,
      "reach": 8,
      "impact": 3,
      "confidence": 0.75,
      "effort": 2,
      "wsjfScore": 7.5,
      "rationale": "High user demand from 3 customer emails, discussed in last sprint planning",
      "recommendation": "Prioritize for next sprint"
    }
  ],
  "summary": "Brief prioritization summary and recommended ordering"
}"""


class StakeholderReporter:
    """Generates weekly summaries and stakeholder updates."""

    def __init__(
        self,
        llm_client: LlmClient,
        api_client: AppApiClient,
        integration_client: Optional[IntegrationClient] = None,
    ) -> None:
        self.llm = llm_client
        self.api = api_client
        self.integration = integration_client

    async def generate_weekly_summary(
        self,
        project_id: str,
        auth_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a comprehensive weekly summary."""
        logger.info(f'Generating weekly summary for project {project_id}')

        context = await self._gather_context(project_id, auth_token)
        if not context:
            return {
                'executiveSummary': 'No data available for weekly summary.',
                'metrics': {},
                'highlights': [],
                'risks': [],
                'recommendations': [],
            }

        result = await self.llm.chat(
            system=WEEKLY_SUMMARY_PROMPT,
            user=context,
            temperature=0.1,
            max_tokens=4096,
        )

        parsed = self._parse_json(result.get('content', ''))
        if parsed:
            # Persist summary via API
            try:
                from datetime import datetime, timedelta
                now = datetime.utcnow()
                week_ago = now - timedelta(days=7)
                await self.api.post(
                    f'/projects/{project_id}/intelligence/summaries',
                    {
                        'executiveSummary': parsed.get('executiveSummary', ''),
                        'metrics': parsed.get('metrics'),
                        'highlights': parsed.get('highlights'),
                        'risks': parsed.get('risks'),
                        'recommendations': parsed.get('recommendations'),
                        'periodStart': week_ago.isoformat(),
                        'periodEnd': now.isoformat(),
                    },
                    auth_token=auth_token,
                )
            except Exception as exc:
                logger.warning(f'Failed to persist weekly summary: {exc}')

            return parsed

        return {
            'executiveSummary': 'Summary generation failed.',
            'metrics': {},
            'highlights': [],
            'risks': [],
            'recommendations': [],
        }

    async def generate_stakeholder_update(
        self,
        project_id: str,
        audience: str = 'stakeholder',
        auth_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a stakeholder update tailored to audience."""
        logger.info(f'Generating {audience} stakeholder update for project {project_id}')

        context = await self._gather_context(project_id, auth_token)
        if not context:
            return {
                'subject': 'Weekly Project Update',
                'body': 'No data available for stakeholder update.',
                'audience': audience,
                'keyPoints': [],
            }

        user_prompt = f"Audience: {audience}\n\n{context}"

        result = await self.llm.chat(
            system=STAKEHOLDER_UPDATE_PROMPT,
            user=user_prompt,
            temperature=0.2,
            max_tokens=4096,
        )

        parsed = self._parse_json(result.get('content', ''))
        return parsed or {
            'subject': 'Weekly Project Update',
            'body': 'Stakeholder update generation failed.',
            'audience': audience,
            'keyPoints': [],
        }

    async def prioritize(
        self,
        project_id: str,
        items: Optional[List[Dict[str, Any]]] = None,
        auth_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """RICE/WSJF prioritization of issues."""
        logger.info(f'Running prioritization for project {project_id}')

        context_parts = []

        # If specific items provided, use them; otherwise fetch from Linear
        if items:
            context_parts.append(f"Items to prioritize:\n{json.dumps(items, indent=2, default=str)}")
        elif self.integration and auth_token:
            issues_data = await self.integration.get_linear_issues(
                project_id=project_id,
                auth_token=auth_token,
            )
            if issues_data:
                context_parts.append(f"Linear Issues:\n{json.dumps(issues_data, indent=2, default=str)}")

        # Add context from meetings, emails, activity
        extra = await self._gather_context(project_id, auth_token)
        if extra:
            context_parts.append(f"Additional Context:\n{extra}")

        if not context_parts:
            return {
                'items': [],
                'summary': 'No items available for prioritization.',
            }

        user_prompt = '\n\n---\n\n'.join(context_parts)

        result = await self.llm.chat(
            system=PRIORITIZATION_PROMPT,
            user=user_prompt,
            temperature=0.1,
            max_tokens=4096,
        )

        parsed = self._parse_json(result.get('content', ''))
        return parsed or {'items': [], 'summary': 'Prioritization failed.'}

    async def _gather_context(
        self,
        project_id: str,
        auth_token: Optional[str] = None,
    ) -> str:
        """Gather all available context for summary/update generation."""
        parts = []

        if self.integration:
            # Activity events
            events = await self.integration.get_activity_stream(
                project_id=project_id, limit=40, auth_token=auth_token,
            )
            if events:
                parts.append(f"Activity Events ({len(events)}):\n{json.dumps(events[:25], indent=2, default=str)}")

            # Linear data
            if auth_token:
                linear_data = await self.integration.get_linear_sync_summary(
                    project_id=project_id, auth_token=auth_token,
                )
                if linear_data:
                    parts.append(f"Sprint Data:\n{json.dumps(linear_data, indent=2, default=str)}")

            # Meetings
            meetings = await self.integration.get_meetings(
                project_id=project_id, auth_token=auth_token,
            )
            if meetings:
                insights = []
                for m in meetings[:5]:
                    for ins in m.get('insights', []):
                        if ins.get('status') != 'dismissed':
                            insights.append({
                                'meeting': m.get('title'),
                                'type': ins.get('insightType'),
                                'content': ins.get('content'),
                            })
                if insights:
                    parts.append(f"Meeting Insights:\n{json.dumps(insights, indent=2, default=str)}")

        # Standup responses
        try:
            data = await self.api.get(
                f'/projects/{project_id}/standups/responses?limit=20',
                auth_token=auth_token,
            )
            if data and isinstance(data, list) and data:
                parts.append(f"Recent Standups ({len(data)}):\n{json.dumps(data[:10], indent=2, default=str)}")
        except Exception:
            pass

        # Existing risks
        try:
            risks = await self.api.get(
                f'/projects/{project_id}/intelligence/risks?status=open',
                auth_token=auth_token,
            )
            if risks and isinstance(risks, list) and risks:
                parts.append(f"Open Risks ({len(risks)}):\n{json.dumps(risks, indent=2, default=str)}")
        except Exception:
            pass

        return '\n\n---\n\n'.join(parts) if parts else ''

    def _parse_json(self, content: str) -> Optional[Dict[str, Any]]:
        try:
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0]
            elif '```' in content:
                content = content.split('```')[1].split('```')[0]
            return json.loads(content.strip())
        except (json.JSONDecodeError, KeyError, IndexError) as exc:
            logger.warning(f'Failed to parse LLM JSON: {exc}')
            return None
