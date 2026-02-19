from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import run_router, stream_router, documents_router, knowledge_router, roadmap_router, meetings_router, standups_router, intelligence_router
from app.config import get_settings
from app.graph import GraphServices
from app.observability import RunEventBus
from app.schemas import HealthResponse
from app.tools import AppApiClient, LlmClient, MemoryClient, EmbeddingClient, DocRetriever, MinioClient
from app.tools.tavily_client import TavilyClient
from app.tools.integration_client import IntegrationClient


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
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

    # Initialize Tavily client (optional - web search disabled if unavailable)
    tavily_client = None
    if settings.tavily_api_key:
        try:
            tavily_client = TavilyClient(api_key=settings.tavily_api_key)
            print("[INFO] Tavily client initialized")
        except Exception as e:
            print(f"[WARN] Tavily client unavailable: {e}")

    # Initialize embedding client (optional - RAG disabled if unavailable)
    embedding_client = None
    try:
        embedding_client = EmbeddingClient()
        print("[INFO] Embedding client initialized (Ollama)")
    except Exception as e:
        print(f"[WARN] Embedding client unavailable, RAG disabled: {e}")

    # Initialize MinIO client (optional - doc processing disabled if unavailable)
    minio_client = None
    try:
        minio_client = MinioClient()
        print("[INFO] MinIO client initialized")
    except Exception as e:
        print(f"[WARN] MinIO client unavailable, document processing disabled: {e}")

    # Initialize doc retriever (requires embedding client)
    doc_retriever = None
    if embedding_client:
        try:
            doc_retriever = DocRetriever(embedding_client)
            print("[INFO] Doc retriever initialized")
        except Exception as e:
            print(f"[WARN] Doc retriever unavailable: {e}")

    # Initialize integration client (always available since it just wraps the API client)
    integration_client = IntegrationClient(api_client=app_api_client)
    print("[INFO] Integration client initialized")

    app.state.graph_services = GraphServices(
        app_api_client=app_api_client,
        event_bus=event_bus,
        llm_client=llm_client,
        memory_client=memory_client,
        tavily_client=tavily_client,
        embedding_client=embedding_client,
        doc_retriever=doc_retriever,
        integration_client=integration_client,
    )
    app.state.event_bus = event_bus
    app.state.embedding_client = embedding_client
    app.state.minio_client = minio_client

    yield

    await app_api_client.close()
    await llm_client.close()
    if tavily_client:
        await tavily_client.close()
    if embedding_client:
        await embedding_client.close()


def create_app() -> FastAPI:
    app = FastAPI(title='AgentPM Service', lifespan=lifespan)
    app.include_router(run_router)
    app.include_router(stream_router)
    app.include_router(documents_router)
    app.include_router(knowledge_router)
    app.include_router(roadmap_router)
    app.include_router(meetings_router)
    app.include_router(standups_router)
    app.include_router(intelligence_router)

    @app.get('/health', response_model=HealthResponse, response_model_by_alias=True)
    async def health() -> HealthResponse:
        return HealthResponse()

    return app


app = create_app()
