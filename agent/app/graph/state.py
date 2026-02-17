from __future__ import annotations

from typing import Any, Dict, List, TypedDict
from typing_extensions import NotRequired


class AgentState(TypedDict):
    runId: str
    question: str
    authToken: NotRequired[str]
    userContext: NotRequired[Dict[str, Any]]
    userHoldingSymbols: NotRequired[List[str]]
    intent: NotRequired[Dict[str, Any]]
    intentType: NotRequired[str]
    requiredDataSources: NotRequired[List[str]]
    dataQuality: NotRequired[Dict[str, str]]
    conversationHistory: NotRequired[List[Dict[str, Any]]]
    constraints: NotRequired[List[Dict[str, Any]]]
    candidates: NotRequired[List[Dict[str, Any]]]
    resolvedCandidates: NotRequired[List[Dict[str, Any]]]
    toolResults: NotRequired[Dict[str, Any]]
    events: NotRequired[Dict[str, Any]]
    prices: NotRequired[Dict[str, Any]]
    timeSeries: NotRequired[Dict[str, Any]]
    fundamentals: NotRequired[Dict[str, Any]]
    estimates: NotRequired[Dict[str, Any]]
    news: NotRequired[Dict[str, Any]]
    sentiment: NotRequired[Dict[str, Any]]
    scores: NotRequired[Dict[str, Any]]
    decision: NotRequired[Dict[str, Any]]
    visualization: NotRequired[Dict[str, Any]]
    finalAnswer: NotRequired[str]
    conversationTitle: NotRequired[str]
    memoryUpdates: NotRequired[Dict[str, Any]]
    allocations: NotRequired[List[Dict[str, Any]]]
    relevantMemories: NotRequired[List[Dict[str, Any]]]
    metadata: NotRequired[Dict[str, Any]]
    toolCallCount: NotRequired[int]
    timings: NotRequired[Dict[str, Any]]
    providerUsed: NotRequired[Dict[str, Any]]
    warnings: NotRequired[List[str]]
    actions: NotRequired[List[Dict[str, Any]]]
    webResearch: NotRequired[Dict[str, Any]]
    deepReport: NotRequired[Dict[str, Any]]
    analysisMode: NotRequired[str]
    executionMode: NotRequired[str]
    deepAnalysis: NotRequired[bool]
