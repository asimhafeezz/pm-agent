from __future__ import annotations

import io
import logging
from typing import Any, Dict, List, Optional

from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.tools.embedding_client import EmbeddingClient
from app.tools.minio_client import MinioClient
from app.tools import AppApiClient

logger = logging.getLogger(__name__)


def _parse_pdf(data: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return '\n\n'.join(pages)


def _parse_docx(data: bytes) -> str:
    from docx import Document as DocxDocument
    doc = DocxDocument(io.BytesIO(data))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return '\n\n'.join(paragraphs)


def _parse_text(data: bytes) -> str:
    return data.decode('utf-8', errors='replace')


MIME_PARSERS = {
    'application/pdf': _parse_pdf,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': _parse_docx,
    'text/plain': _parse_text,
    'text/markdown': _parse_text,
}


class DocumentProcessor:
    """Processes uploaded documents: parse, chunk, embed, and persist."""

    def __init__(
        self,
        minio_client: Optional[MinioClient],
        embedding_client: EmbeddingClient,
        api_client: AppApiClient,
    ) -> None:
        self.minio = minio_client
        self.embedding = embedding_client
        self.api = api_client
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=1500,
            chunk_overlap=150,
            length_function=len,
            separators=['\n\n', '\n', '. ', ' ', ''],
        )

    async def process(self, document_id: str, s3_key: str, mime_type: str, project_id: str) -> None:
        """Full document processing pipeline."""
        try:
            # Update status to processing
            await self.api.patch(f'/documents/{document_id}/status', {
                'status': 'processing',
            })

            if self.minio is None:
                raise ValueError('MinIO client is not available')

            # 1. Download from MinIO
            logger.info(f'Downloading {s3_key} from MinIO')
            data = self.minio.download(s3_key)

            # 2. Parse document
            parser = MIME_PARSERS.get(mime_type)
            if not parser:
                raise ValueError(f'Unsupported MIME type: {mime_type}')
            text = parser(data)
            await self.process_text(document_id=document_id, text=text, project_id=project_id)

        except Exception as exc:
            logger.error(f'Document processing failed for {document_id}: {exc}')
            try:
                await self.api.patch(f'/documents/{document_id}/status', {
                    'status': 'failed',
                    'processingError': str(exc),
                })
            except Exception:
                logger.error(f'Failed to update error status for {document_id}')
            raise

    async def process_text(self, document_id: str, text: str, project_id: str) -> None:
        """Process plain text content: chunk, embed, and persist."""
        try:
            await self.api.patch(f'/documents/{document_id}/status', {
                'status': 'processing',
            })

            if not text.strip():
                raise ValueError('Document contains no extractable text')

            logger.info(f'Parsed document: {len(text)} chars')

            # 3. Chunk text
            chunks = self.splitter.split_text(text)
            logger.info(f'Split into {len(chunks)} chunks')

            # 4. Generate embeddings in batches
            embeddings = await self.embedding.embed_batch(
                [c for c in chunks],
                batch_size=10,
            )

            # 5. Prepare chunk payloads
            chunk_payloads: List[Dict[str, Any]] = []
            for i, (chunk_text, emb) in enumerate(zip(chunks, embeddings)):
                chunk_payloads.append({
                    'chunkIndex': i,
                    'content': chunk_text,
                    'embedding': emb,
                    'tokenCount': len(chunk_text.split()),
                })

            # 6. Bulk create chunks via API
            await self.api.post(f'/documents/{document_id}/chunks', {
                'chunks': chunk_payloads,
            })

            # 7. Update document status
            await self.api.patch(f'/documents/{document_id}/status', {
                'status': 'processed',
                'chunkCount': len(chunks),
            })

            logger.info(f'Document {document_id} processed: {len(chunks)} chunks')

        except Exception as exc:
            logger.error(f'Document text processing failed for {document_id}: {exc}')
            try:
                await self.api.patch(f'/documents/{document_id}/status', {
                    'status': 'failed',
                    'processingError': str(exc),
                })
            except Exception:
                logger.error(f'Failed to update error status for {document_id}')
            raise
