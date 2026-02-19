from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, BackgroundTasks, Request
from pydantic import BaseModel

from app.pipelines.knowledge_extractor import KnowledgeExtractor

router = APIRouter()
logger = logging.getLogger(__name__)


class ExtractKnowledgeRequest(BaseModel):
    projectId: str
    documentIds: List[str]


class ExtractKnowledgeResponse(BaseModel):
    status: str
    projectId: str


async def _run_extraction(
    request: ExtractKnowledgeRequest,
    api_client,
    llm_client,
    embedding_client,
):
    try:
        extractor = KnowledgeExtractor(
            llm_client=llm_client,
            embedding_client=embedding_client,
            api_client=api_client,
        )
        result = await extractor.extract(
            project_id=request.projectId,
            document_ids=request.documentIds,
        )
        logger.info(
            'Knowledge extraction finished for project %s: %s',
            request.projectId,
            result,
        )
    except Exception as exc:
        logger.exception(
            'Knowledge extraction failed for project %s: %s',
            request.projectId,
            exc,
        )


@router.post('/agent/extract-knowledge', response_model=ExtractKnowledgeResponse)
async def extract_knowledge(
    payload: ExtractKnowledgeRequest,
    background_tasks: BackgroundTasks,
    request: Request,
) -> ExtractKnowledgeResponse:
    services = request.app.state.graph_services
    embedding_client = request.app.state.embedding_client

    background_tasks.add_task(
        _run_extraction,
        payload,
        services.app_api_client,
        services.llm_client,
        embedding_client,
    )

    return ExtractKnowledgeResponse(
        status='extracting',
        projectId=payload.projectId,
    )
