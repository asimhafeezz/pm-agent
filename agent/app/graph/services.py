from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Optional

from app.observability import RunEventBus
from app.tools import AppApiClient, LlmClient, MemoryClient, EmbeddingClient, DocRetriever
from app.tools.tavily_client import TavilyClient
from app.tools.integration_client import IntegrationClient


@dataclass
class GraphServices:
    app_api_client: AppApiClient
    event_bus: RunEventBus
    llm_client: LlmClient
    memory_client: Optional[MemoryClient] = None
    tavily_client: Optional[TavilyClient] = None
    embedding_client: Optional[EmbeddingClient] = None
    doc_retriever: Optional[DocRetriever] = None
    integration_client: Optional[IntegrationClient] = None
    tool_budget_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
