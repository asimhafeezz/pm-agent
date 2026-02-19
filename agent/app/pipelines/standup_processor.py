from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from app.tools import AppApiClient, LlmClient
from app.tools.integration_client import IntegrationClient

logger = logging.getLogger(__name__)

STANDUP_SUMMARY_PROMPT = """You are an AI Scrum Master assistant. Analyze these daily standup responses and produce a concise team summary.

For each team member's response, identify:
1. What they completed yesterday
2. What they're working on today
3. Any blockers or risks

Then produce a unified team summary that includes:
- **Overall Progress**: What the team accomplished and is working on
- **Blockers & Risks**: Any blockers mentioned, with severity assessment
- **Discrepancies**: Note if someone says they completed something but the ticket status doesn't match (if ticket data is available)
- **Action Items**: Suggested follow-ups based on the standup

Respond with ONLY valid JSON in this exact format:
{
  "summary": "2-3 sentence executive summary of team status",
  "memberSummaries": [
    {
      "respondent": "Person Name",
      "yesterday": "what they completed",
      "today": "what they're working on",
      "blockers": "any blockers or null",
      "status": "on_track | at_risk | blocked"
    }
  ],
  "teamBlockers": [
    {
      "description": "blocker description",
      "severity": "high | medium | low",
      "reporter": "Person Name",
      "suggestedAction": "what to do about it"
    }
  ],
  "discrepancies": [
    {
      "description": "e.g. John says ENG-123 is done but ticket still shows In Progress",
      "reporter": "Person Name"
    }
  ],
  "actionItems": [
    "Follow up with X about Y",
    "Unblock Z by doing W"
  ]
}"""

SPRINT_DIGEST_PROMPT = """You are an AI PM assistant generating a sprint health digest.

Given the following data about the current sprint, produce a comprehensive yet concise digest:
- Linear sprint/cycle data (if available)
- Recent standup summaries
- Recent activity events
- Meeting insights

Produce a digest that includes:
1. **Sprint Health Score** (0-100): Based on velocity, blockers, and completion rate
2. **Key Metrics**: Issues completed, in progress, blocked, total
3. **Highlights**: Major accomplishments this sprint
4. **Risks**: Anything threatening sprint completion
5. **Recommendations**: Suggested actions for the PM

Respond with ONLY valid JSON:
{
  "healthScore": 75,
  "summary": "2-3 sentence sprint summary",
  "metrics": {
    "completed": 5,
    "inProgress": 8,
    "blocked": 2,
    "total": 20,
    "velocityTrend": "stable | improving | declining"
  },
  "highlights": ["Completed feature X", "Resolved critical bug Y"],
  "risks": [
    {
      "description": "risk description",
      "severity": "high | medium | low",
      "mitigation": "suggested action"
    }
  ],
  "recommendations": ["Prioritize unblocking ENG-456", "Schedule design review for feature Z"]
}"""

BLOCKER_CHECK_PROMPT = """You are an AI PM assistant checking for blockers and risks.

Given the following project data (Linear issues, activity events, standup blockers), identify:
1. Issues that have been blocked for more than 48 hours
2. Issues with no recent updates that may be stalled
3. Unresolved blockers from standups or meetings
4. Any patterns that suggest risk (e.g. scope creep, velocity decline)

Respond with ONLY valid JSON:
{
  "blockers": [
    {
      "description": "what is blocked",
      "issueId": "ENG-123 or null",
      "blockedSince": "date or estimate",
      "severity": "critical | high | medium",
      "suggestedAction": "how to unblock"
    }
  ],
  "staleIssues": [
    {
      "issueId": "ENG-456",
      "title": "issue title",
      "lastUpdate": "date",
      "daysSinceUpdate": 5
    }
  ],
  "escalations": [
    {
      "description": "what needs escalation",
      "urgency": "immediate | soon | monitor",
      "suggestedRecipient": "team lead / manager / specific person"
    }
  ],
  "summary": "Brief summary of overall blocker status"
}"""


class StandupProcessor:
    """Processes standup responses: summarize, cross-reference, detect discrepancies."""

    def __init__(
        self,
        llm_client: LlmClient,
        api_client: AppApiClient,
        integration_client: Optional[IntegrationClient] = None,
    ) -> None:
        self.llm = llm_client
        self.api = api_client
        self.integration = integration_client

    async def process_standup(
        self,
        project_id: str,
        responses: List[Dict[str, Any]],
        auth_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Process standup responses into a unified summary."""
        if not responses:
            return {
                'summary': 'No standup responses to process.',
                'memberSummaries': [],
                'teamBlockers': [],
                'discrepancies': [],
                'actionItems': [],
            }

        logger.info(f'Processing {len(responses)} standup responses for project {project_id}')

        # Build context: format responses for LLM
        response_text = self._format_responses(responses)

        # Optionally fetch Linear data for cross-referencing
        linear_context = ''
        if self.integration and auth_token:
            linear_context = await self._fetch_linear_context(project_id, auth_token)

        user_prompt = f"Team Standup Responses:\n{response_text}"
        if linear_context:
            user_prompt += f"\n\nCurrent Sprint Ticket Data:\n{linear_context}"

        result = await self.llm.chat(
            system=STANDUP_SUMMARY_PROMPT,
            user=user_prompt,
            temperature=0.1,
            max_tokens=4096,
        )

        content = result.get('content', '')
        parsed = self._parse_json(content)

        if parsed:
            logger.info(f'Standup summary generated: {len(parsed.get("memberSummaries", []))} members')
            return parsed

        return {
            'summary': f'{len(responses)} standup responses collected. LLM summary unavailable.',
            'memberSummaries': [],
            'teamBlockers': [],
            'discrepancies': [],
            'actionItems': [],
            'responses': responses,
        }

    async def generate_sprint_digest(
        self,
        project_id: str,
        user_id: str,
        config: Optional[Dict[str, Any]] = None,
        auth_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a sprint health digest from all available data."""
        logger.info(f'Generating sprint digest for project {project_id}')

        context_parts = []

        # Fetch Linear sprint data
        if self.integration and auth_token:
            linear_data = await self.integration.get_linear_sync_summary(
                project_id=project_id,
                auth_token=auth_token,
            )
            if linear_data:
                context_parts.append(f"Linear Sprint Data:\n{json.dumps(linear_data, indent=2, default=str)}")

        # Fetch recent activity events
        if self.integration:
            events = await self.integration.get_activity_stream(
                project_id=project_id,
                limit=30,
                auth_token=auth_token,
            )
            if events:
                context_parts.append(f"Recent Activity Events ({len(events)}):\n{json.dumps(events[:20], indent=2, default=str)}")

        # Fetch today's standup responses
        try:
            standup_data = await self.api.get(
                f'/projects/{project_id}/standups/today',
                auth_token=auth_token,
            )
            if standup_data:
                responses_list = standup_data if isinstance(standup_data, list) else standup_data.get('responses', [])
                if responses_list:
                    context_parts.append(f"Today's Standup Responses:\n{json.dumps(responses_list, indent=2, default=str)}")
        except Exception as exc:
            logger.warning(f'Failed to fetch standup data: {exc}')

        # Fetch recent meeting insights
        if self.integration:
            meetings = await self.integration.get_meetings(
                project_id=project_id,
                auth_token=auth_token,
            )
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
                context_parts.append(f"Recent Meeting Insights:\n{json.dumps(insights, indent=2, default=str)}")

        if not context_parts:
            return {
                'healthScore': 0,
                'summary': 'No data available for sprint digest.',
                'metrics': {},
                'highlights': [],
                'risks': [],
                'recommendations': ['Connect integrations and collect standup data to generate sprint digests.'],
            }

        user_prompt = '\n\n---\n\n'.join(context_parts)

        result = await self.llm.chat(
            system=SPRINT_DIGEST_PROMPT,
            user=user_prompt,
            temperature=0.1,
            max_tokens=4096,
        )

        parsed = self._parse_json(result.get('content', ''))
        if parsed:
            logger.info(f'Sprint digest generated: health score {parsed.get("healthScore", "N/A")}')
            return parsed

        return {
            'healthScore': 0,
            'summary': 'Sprint digest generation failed. LLM response could not be parsed.',
            'metrics': {},
            'highlights': [],
            'risks': [],
            'recommendations': [],
        }

    async def check_blockers(
        self,
        project_id: str,
        user_id: str,
        config: Optional[Dict[str, Any]] = None,
        auth_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Check for blockers, stale issues, and escalation needs."""
        logger.info(f'Running blocker check for project {project_id}')

        context_parts = []

        # Fetch Linear issues (especially blocked ones)
        if self.integration and auth_token:
            issues_data = await self.integration.get_linear_issues(
                project_id=project_id,
                auth_token=auth_token,
            )
            if issues_data:
                context_parts.append(f"Linear Issues:\n{json.dumps(issues_data, indent=2, default=str)}")

        # Fetch recent activity for staleness detection
        if self.integration:
            events = await self.integration.get_activity_stream(
                project_id=project_id,
                limit=50,
                auth_token=auth_token,
            )
            if events:
                context_parts.append(f"Recent Activity:\n{json.dumps(events[:30], indent=2, default=str)}")

        # Fetch standup blockers
        try:
            standup_data = await self.api.get(
                f'/projects/{project_id}/standups/today',
                auth_token=auth_token,
            )
            if standup_data:
                responses_list = standup_data if isinstance(standup_data, list) else standup_data.get('responses', [])
                blockers = [
                    {'respondent': r.get('respondent'), 'blockers': r.get('blockers')}
                    for r in responses_list
                    if r.get('blockers')
                ]
                if blockers:
                    context_parts.append(f"Standup Blockers:\n{json.dumps(blockers, indent=2, default=str)}")
        except Exception as exc:
            logger.warning(f'Failed to fetch standup blockers: {exc}')

        if not context_parts:
            return {
                'blockers': [],
                'staleIssues': [],
                'escalations': [],
                'summary': 'No data available for blocker analysis.',
            }

        user_prompt = '\n\n---\n\n'.join(context_parts)

        result = await self.llm.chat(
            system=BLOCKER_CHECK_PROMPT,
            user=user_prompt,
            temperature=0.1,
            max_tokens=4096,
        )

        parsed = self._parse_json(result.get('content', ''))
        if parsed:
            logger.info(f'Blocker check complete: {len(parsed.get("blockers", []))} blockers found')
            return parsed

        return {
            'blockers': [],
            'staleIssues': [],
            'escalations': [],
            'summary': 'Blocker check failed. LLM response could not be parsed.',
        }

    async def trigger_standup(
        self,
        project_id: str,
        user_id: str,
        config: Optional[Dict[str, Any]] = None,
        auth_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Trigger standup prompts — sends DMs via Slack or other channels."""
        logger.info(f'Triggering standup for project {project_id}')

        # The actual Slack DM sending is handled by the integration-service.
        # This endpoint orchestrates: figure out who to prompt and via what channel.
        channel = (config or {}).get('channel', 'slack')
        recipients = (config or {}).get('recipients', [])

        if not recipients:
            logger.warning('No standup recipients configured')
            return {
                'status': 'skipped',
                'reason': 'No recipients configured for standup',
            }

        # For each recipient, send a standup prompt via integration-service
        sent = []
        failed = []
        for recipient in recipients:
            try:
                await self.api.post(
                    f'/integrations/communication/slack/send-message',
                    {
                        'channel': recipient.get('slackUserId') or recipient.get('channel'),
                        'text': (
                            f"Good morning! Time for standup.\n\n"
                            f"Please reply with:\n"
                            f"*Yesterday*: What did you complete?\n"
                            f"*Today*: What are you working on?\n"
                            f"*Blockers*: Anything blocking you?\n\n"
                            f"Or use `/standup` to submit your response."
                        ),
                    },
                    auth_token=auth_token,
                )
                sent.append(recipient.get('name', recipient.get('slackUserId', 'unknown')))
            except Exception as exc:
                logger.warning(f'Failed to send standup prompt to {recipient}: {exc}')
                failed.append(recipient.get('name', 'unknown'))

        return {
            'status': 'triggered',
            'sent': sent,
            'failed': failed,
            'channel': channel,
        }

    def _format_responses(self, responses: List[Dict[str, Any]]) -> str:
        """Format standup responses into readable text for LLM."""
        parts = []
        for r in responses:
            name = r.get('respondent', 'Unknown')
            raw = r.get('rawText', '')
            yesterday = r.get('yesterday', '')
            today = r.get('today', '')
            blockers = r.get('blockers', '')

            if yesterday or today or blockers:
                entry = f"**{name}**:\n"
                if yesterday:
                    entry += f"  Yesterday: {yesterday}\n"
                if today:
                    entry += f"  Today: {today}\n"
                if blockers:
                    entry += f"  Blockers: {blockers}\n"
            else:
                entry = f"**{name}**: {raw}\n"
            parts.append(entry)

        return '\n'.join(parts)

    async def _fetch_linear_context(
        self,
        project_id: str,
        auth_token: str,
    ) -> str:
        """Fetch Linear issue data for cross-referencing standup responses."""
        try:
            data = await self.integration.get_linear_issues(
                project_id=project_id,
                auth_token=auth_token,
            )
            if not data:
                return ''

            issues = data.get('issues', data) if isinstance(data, dict) else data
            if not isinstance(issues, list):
                return ''

            lines = []
            for issue in issues[:30]:
                status = issue.get('state', {}).get('name', 'Unknown') if isinstance(issue.get('state'), dict) else issue.get('status', 'Unknown')
                assignee = issue.get('assignee', {}).get('name', 'Unassigned') if isinstance(issue.get('assignee'), dict) else 'Unassigned'
                lines.append(f"- {issue.get('identifier', '???')}: {issue.get('title', 'No title')} [{status}] ({assignee})")

            return '\n'.join(lines)
        except Exception as exc:
            logger.warning(f'Failed to fetch Linear context for standup: {exc}')
            return ''

    def _parse_json(self, content: str) -> Optional[Dict[str, Any]]:
        """Parse JSON from LLM response, handling markdown code blocks."""
        try:
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0]
            elif '```' in content:
                content = content.split('```')[1].split('```')[0]

            return json.loads(content.strip())
        except (json.JSONDecodeError, KeyError, IndexError) as exc:
            logger.warning(f'Failed to parse LLM JSON response: {exc}')
            logger.debug(f'Raw LLM response: {content[:500]}')
            return None
