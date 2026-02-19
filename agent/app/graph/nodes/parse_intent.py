from __future__ import annotations

import logging
from typing import Any, Dict

from app.graph.services import GraphServices
from app.graph.state import AgentState

logger = logging.getLogger(__name__)

INTENT_KEYWORDS = {
    'document_qa': ['document', 'docs', 'uploaded', 'file', 'pdf', 'specification', 'requirement'],
    'roadmap_query': ['roadmap', 'timeline', 'milestone', 'quarter', 'plan'],
    'ticket_query': ['ticket', 'story', 'epic', 'task', 'sprint', 'backlog', 'kanban', 'assignee'],
    'knowledge_query': ['feature', 'persona', 'entity', 'knowledge', 'graph', 'dependency', 'architecture'],
    'meeting_query': ['meeting', 'standup', 'retro', 'discussed', 'action item', 'decided', 'transcript', 'scrum', 'sync'],
    'risk_query': ['risk', 'blocker', 'blocked', 'stale', 'overdue', 'at risk', 'escalat', 'aging'],
    'summary_query': ['summary', 'weekly', 'digest', 'report', 'what happened', 'status update', 'recap'],
    'priority_query': ['prioritize', 'priority', 'rice', 'wsjf', 'rank', 'score', 'triage', 'what should we work on'],
    'stakeholder_query': ['stakeholder', 'executive update', 'board update', 'investor', 'status email'],
}


def parse_intent_node(services: GraphServices):
    async def _node(state: AgentState) -> Dict[str, Any]:
        question = state.get('question', '').lower()

        # Simple keyword-based intent detection (will be upgraded to LLM-based in Phase 2)
        detected_type = 'general_chat'
        for intent_type, keywords in INTENT_KEYWORDS.items():
            if any(kw in question for kw in keywords):
                detected_type = intent_type
                break

        logger.info('[%s] Intent classified as: %s', state.get('runId', '?'), detected_type)

        return {
            'intentType': detected_type,
            'intent': {
                'type': detected_type,
            },
        }

    return _node
