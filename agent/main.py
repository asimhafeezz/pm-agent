from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import run_router, stream_router
from app.config import get_settings
from app.graph import GraphServices
from app.observability import RunEventBus
from app.schemas import HealthResponse
from app.tools import AppApiClient, IntegrationClient, LlmClient, MemoryClient
from app.tools.tavily_client import TavilyClient


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    integration_client = IntegrationClient(
        base_url=settings.integration_base_url,
        timeout_seconds=settings.integration_timeout_seconds,
    )
    app_api_client = AppApiClient(
        base_url=settings.app_api_base_url,
        timeout_seconds=settings.app_api_timeout_seconds,
    )
    llm_client = LlmClient(
        api_key=settings.groq_api_key,
        model=settings.groq_model,
    )
    event_bus = RunEventBus()

    # Initialize mem0 client (optional - graceful degradation if unavailable)
    memory_client = None
    try:
        memory_client = MemoryClient()
    except Exception as e:
        print(f"[WARN] Mem0 client unavailable, semantic memory disabled: {e}")

    # Initialize Tavily client (optional - deep analysis web search disabled if unavailable)
    tavily_client = None
    if settings.tavily_api_key:
        try:
            tavily_client = TavilyClient(api_key=settings.tavily_api_key)
            print("[INFO] Tavily client initialized for deep analysis")
        except Exception as e:
            print(f"[WARN] Tavily client unavailable, deep analysis web search disabled: {e}")
    else:
        print("[INFO] TAVILY_API_KEY not set, deep analysis web search disabled")

    app.state.graph_services = GraphServices(
        app_api_client=app_api_client,
        integration_client=integration_client,
        event_bus=event_bus,
        llm_client=llm_client,
        memory_client=memory_client,
        tavily_client=tavily_client,
    )
    app.state.event_bus = event_bus

    yield

    await integration_client.close()
    await app_api_client.close()
    await llm_client.close()
    if tavily_client:
        await tavily_client.close()


def create_app() -> FastAPI:
    app = FastAPI(title='Agent Service', lifespan=lifespan)
    app.include_router(run_router)
    app.include_router(stream_router)

    @app.get('/health', response_model=HealthResponse, response_model_by_alias=True)
    async def health() -> HealthResponse:
        return HealthResponse()

    return app


app = create_app()
