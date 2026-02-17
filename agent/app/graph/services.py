from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Optional

from app.observability import RunEventBus
from app.tools import AppApiClient, IntegrationClient, LlmClient, MemoryClient
from app.tools.tavily_client import TavilyClient


@dataclass
class GraphServices:
    app_api_client: AppApiClient
    integration_client: IntegrationClient
    event_bus: RunEventBus
    llm_client: LlmClient
    memory_client: Optional[MemoryClient] = None
    tavily_client: Optional[TavilyClient] = None
    tool_budget_lock: asyncio.Lock = field(default_factory=asyncio.Lock)

