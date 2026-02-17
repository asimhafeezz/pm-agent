from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

try:
    from pydantic import ConfigDict
except ImportError:  # pragma: no cover - pydantic v1 fallback
    ConfigDict = dict  # type: ignore


def to_camel(string: str) -> str:
    parts = string.split('_')
    return parts[0] + ''.join(word.capitalize() for word in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra='forbid',
    )


class RunConfig(CamelModel):
    max_tool_calls: Optional[int] = None
    max_news_articles_per_symbol: Optional[int] = None
    tool_timeout_seconds: Optional[float] = None


class RunRequest(CamelModel):
    run_id: str
    conversation_id: Optional[str] = None
    user_id: str
    user_context: Dict[str, Any]
    question: str
    symbols: Optional[List[str]] = None
    run_config: Optional[RunConfig] = None


class RunResponse(CamelModel):
    run_id: str


class RunResult(CamelModel):
    run_id: str
    status: str
    final_answer: Optional[str] = None
    decision: Optional[Dict[str, Any]] = None
    allocations: Optional[List[Dict[str, Any]]] = None
    risks: Optional[List[str]] = None
    warnings: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None
    completed_at: Optional[datetime] = None


class StreamEvent(CamelModel):
    run_id: str
    event: str
    timestamp: datetime
    payload: Optional[Dict[str, Any]] = None


class HealthResponse(CamelModel):
    status: str = Field(default='ok')
