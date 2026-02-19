from __future__ import annotations

from typing import Any, Dict, List, TypedDict
from typing_extensions import NotRequired


class AgentState(TypedDict):
    runId: str
    question: str
    authToken: NotRequired[str]
    userContext: NotRequired[Dict[str, Any]]
    projectId: NotRequired[str]

    # Intent classification
    intent: NotRequired[Dict[str, Any]]
    intentType: NotRequired[str]  # general_chat, document_qa, roadmap_query, ticket_query, knowledge_query, meeting_query, risk_query, summary_query, priority_query, stakeholder_query

    # Conversation context
    conversationHistory: NotRequired[List[Dict[str, Any]]]
    relevantMemories: NotRequired[List[Dict[str, Any]]]

    # RAG context
    retrievedDocuments: NotRequired[List[Dict[str, Any]]]
    knowledgeContext: NotRequired[Dict[str, Any]]

    # Integration context
    activityContext: NotRequired[List[Dict[str, Any]]]
    meetingContext: NotRequired[List[Dict[str, Any]]]
    riskContext: NotRequired[List[Dict[str, Any]]]
    summaryContext: NotRequired[Dict[str, Any]]

    # Output
    finalAnswer: NotRequired[str]
    conversationTitle: NotRequired[str]
    memoryUpdates: NotRequired[Dict[str, Any]]

    # Metadata & diagnostics
    metadata: NotRequired[Dict[str, Any]]
    warnings: NotRequired[List[str]]
    toolCallCount: NotRequired[int]
    timings: NotRequired[Dict[str, Any]]
