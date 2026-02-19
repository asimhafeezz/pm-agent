from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Request
from pydantic import BaseModel

from app.pipelines.document_processor import DocumentProcessor
from app.tools.embedding_client import EmbeddingClient
from app.tools.minio_client import MinioClient

router = APIRouter()
logger = logging.getLogger(__name__)


class ProcessDocumentRequest(BaseModel):
    documentId: str
    s3Key: str
    mimeType: str
    projectId: str


class ProcessDocumentResponse(BaseModel):
    status: str
    documentId: str


class ProcessDocumentTextRequest(BaseModel):
    documentId: str
    projectId: str
    text: str


async def _run_processing(
    request: ProcessDocumentRequest,
    api_client,
    minio_client: MinioClient,
    embedding_client: EmbeddingClient,
):
    try:
        if embedding_client is None:
            raise RuntimeError('Embedding client is unavailable')
        processor = DocumentProcessor(
            minio_client=minio_client,
            embedding_client=embedding_client,
            api_client=api_client,
        )
        await processor.process(
            document_id=request.documentId,
            s3_key=request.s3Key,
            mime_type=request.mimeType,
            project_id=request.projectId,
        )
    except Exception as exc:
        logger.exception('Document processing failed before completion: %s', exc)
        try:
            await api_client.patch(
                f'/documents/{request.documentId}/status',
                {
                    'status': 'failed',
                    'processingError': str(exc),
                },
            )
        except Exception as patch_exc:
            logger.exception('Failed to patch document failed status: %s', patch_exc)


async def _run_text_processing(
    request: ProcessDocumentTextRequest,
    api_client,
    embedding_client: EmbeddingClient,
):
    try:
        if embedding_client is None:
            raise RuntimeError('Embedding client is unavailable')
        processor = DocumentProcessor(
            minio_client=None,
            embedding_client=embedding_client,
            api_client=api_client,
        )
        await processor.process_text(
            document_id=request.documentId,
            project_id=request.projectId,
            text=request.text,
        )
    except Exception as exc:
        logger.exception('Document text processing failed before completion: %s', exc)
        try:
            await api_client.patch(
                f'/documents/{request.documentId}/status',
                {
                    'status': 'failed',
                    'processingError': str(exc),
                },
            )
        except Exception as patch_exc:
            logger.exception('Failed to patch document failed status: %s', patch_exc)


@router.post('/agent/process-document', response_model=ProcessDocumentResponse)
async def process_document(
    payload: ProcessDocumentRequest,
    background_tasks: BackgroundTasks,
    request: Request,
) -> ProcessDocumentResponse:
    services = request.app.state.graph_services
    minio_client = request.app.state.minio_client
    embedding_client = request.app.state.embedding_client

    background_tasks.add_task(
        _run_processing,
        payload,
        services.app_api_client,
        minio_client,
        embedding_client,
    )

    return ProcessDocumentResponse(
        status='processing',
        documentId=payload.documentId,
    )


@router.post('/agent/process-document-text', response_model=ProcessDocumentResponse)
async def process_document_text(
    payload: ProcessDocumentTextRequest,
    background_tasks: BackgroundTasks,
    request: Request,
) -> ProcessDocumentResponse:
    services = request.app.state.graph_services
    embedding_client = request.app.state.embedding_client

    background_tasks.add_task(
        _run_text_processing,
        payload,
        services.app_api_client,
        embedding_client,
    )

    return ProcessDocumentResponse(
        status='processing',
        documentId=payload.documentId,
    )
