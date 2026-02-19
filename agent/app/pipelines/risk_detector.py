from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from app.tools import AppApiClient, LlmClient
from app.tools.integration_client import IntegrationClient

logger = logging.getLogger(__name__)

RISK_DETECTION_PROMPT = """You are an AI PM risk detection engine. Analyze the following project data and identify risks.

Look for these risk signals:
1. **Blocker Aging**: Issues blocked for >48 hours
2. **Velocity Decline**: Fewer issues completed compared to previous periods
3. **Scope Creep**: New issues added mid-sprint, expanding scope
4. **Dependency Risks**: Issues depending on external teams or unresolved blockers
5. **Unresolved Actions**: Action items from meetings or standups that remain unaddressed

For each risk, provide:
- `riskType`: one of "blocker_aging", "velocity_decline", "scope_creep", "dependency_risk", "unresolved_action"
- `severity`: "critical", "high", "medium", or "low"
- `description`: clear description of the risk
- `mitigation`: suggested action to mitigate
- `evidence`: supporting data (issue IDs, dates, metrics)
- `linkedIssueId`: related issue identifier if applicable (or null)

Respond with ONLY valid JSON:
{
  "risks": [
    {
      "riskType": "blocker_aging",
      "severity": "high",
      "description": "ENG-123 has been blocked for 5 days with no updates",
      "mitigation": "Escalate to team lead and schedule unblocking session",
      "evidence": {"issueId": "ENG-123", "blockedDays": 5},
      "linkedIssueId": "ENG-123"
    }
  ],
  "overallHealthScore": 72,
  "summary": "2-3 sentence risk assessment summary"
}"""


class RiskDetector:
    """Detects project risks from activity, sprint data, standups, and meetings."""

    def __init__(
        self,
        llm_client: LlmClient,
        api_client: AppApiClient,
        integration_client: Optional[IntegrationClient] = None,
    ) -> None:
        self.llm = llm_client
        self.api = api_client
        self.integration = integration_client

    async def detect_risks(
        self,
        project_id: str,
        auth_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run full risk detection pipeline."""
        logger.info(f'Running risk detection for project {project_id}')

        context_parts = []

        # 1. Fetch activity events (last 7 days)
        if self.integration:
            events = await self.integration.get_activity_stream(
                project_id=project_id,
                limit=50,
                auth_token=auth_token,
            )
            if events:
                context_parts.append(
                    f"Activity Events (last 7 days, {len(events)} events):\n"
                    + json.dumps(events[:30], indent=2, default=str)
                )

        # 2. Fetch sprint health from Linear
        if self.integration and auth_token:
            linear_data = await self.integration.get_linear_sync_summary(
                project_id=project_id,
                auth_token=auth_token,
            )
            if linear_data:
                context_parts.append(
                    f"Linear Sprint Data:\n{json.dumps(linear_data, indent=2, default=str)}"
                )

            issues_data = await self.integration.get_linear_issues(
                project_id=project_id,
                auth_token=auth_token,
            )
            if issues_data:
                context_parts.append(
                    f"Linear Issues:\n{json.dumps(issues_data, indent=2, default=str)}"
                )

        # 3. Fetch standup blockers
        try:
            standup_data = await self.api.get(
                f'/projects/{project_id}/standups/responses?limit=20',
                auth_token=auth_token,
            )
            if standup_data:
                responses = standup_data if isinstance(standup_data, list) else []
                blockers = [
                    {'respondent': r.get('respondent'), 'blockers': r.get('blockers'), 'date': r.get('respondedAt')}
                    for r in responses if r.get('blockers')
                ]
                if blockers:
                    context_parts.append(
                        f"Standup Blockers:\n{json.dumps(blockers, indent=2, default=str)}"
                    )
        except Exception as exc:
            logger.warning(f'Failed to fetch standup data for risk detection: {exc}')

        # 4. Fetch meeting blockers/action items
        if self.integration:
            meetings = await self.integration.get_meetings(
                project_id=project_id,
                auth_token=auth_token,
            )
            unresolved = []
            for m in meetings[:5]:
                for ins in m.get('insights', []):
                    if ins.get('status') in ('pending', None) and ins.get('insightType') in ('action_item', 'blocker'):
                        unresolved.append({
                            'meeting': m.get('title'),
                            'type': ins.get('insightType'),
                            'content': ins.get('content'),
                            'assignee': ins.get('assignee'),
                        })
            if unresolved:
                context_parts.append(
                    f"Unresolved Meeting Action Items/Blockers:\n{json.dumps(unresolved, indent=2, default=str)}"
                )

        if not context_parts:
            return {
                'risks': [],
                'overallHealthScore': 100,
                'summary': 'No data available for risk detection. Connect integrations to enable risk monitoring.',
            }

        user_prompt = '\n\n---\n\n'.join(context_parts)

        result = await self.llm.chat(
            system=RISK_DETECTION_PROMPT,
            user=user_prompt,
            temperature=0.1,
            max_tokens=4096,
        )

        parsed = self._parse_json(result.get('content', ''))
        if parsed:
            # Persist risks to API
            risks = parsed.get('risks', [])
            if risks:
                try:
                    await self.api.post(
                        f'/projects/{project_id}/intelligence/risks',
                        {'risks': risks},
                        auth_token=auth_token,
                    )
                    logger.info(f'Persisted {len(risks)} risks for project {project_id}')
                except Exception as exc:
                    logger.warning(f'Failed to persist risks: {exc}')

            return parsed

        return {
            'risks': [],
            'overallHealthScore': 0,
            'summary': 'Risk detection failed — LLM response could not be parsed.',
        }

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
