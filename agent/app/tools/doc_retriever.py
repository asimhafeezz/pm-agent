from __future__ import annotations

from typing import Any, Dict, List, Optional

import psycopg2
import psycopg2.extras

from app.config import get_settings
from app.tools.embedding_client import EmbeddingClient


class DocRetriever:
    """Retrieves relevant document chunks via pgvector similarity search."""

    def __init__(self, embedding_client: EmbeddingClient) -> None:
        self.embedding_client = embedding_client
        settings = get_settings()
        self._conn_params = {
            'host': settings.pg_host,
            'port': settings.pg_port,
            'user': settings.pg_user,
            'password': settings.pg_password,
            'dbname': settings.pg_db,
        }

    def _get_conn(self):
        return psycopg2.connect(**self._conn_params)

    async def retrieve(
        self,
        query: str,
        project_id: str,
        top_k: int = 5,
        score_threshold: float = 0.3,
    ) -> List[Dict[str, Any]]:
        """Retrieve top-K similar document chunks for a query within a project."""
        query_embedding = await self.embedding_client.embed(query)
        if not query_embedding:
            return []

        # Use cosine distance operator from pgvector
        # We store embeddings as float arrays, so we use the <=> operator
        sql = """
            SELECT
                dc.id,
                dc."documentId",
                dc."chunkIndex",
                dc.content,
                dc."tokenCount",
                dc.metadata,
                d.title as "documentTitle",
                1 - (dc.embedding::vector <=> %s::vector) as similarity
            FROM document_chunk dc
            JOIN document d ON d.id = dc."documentId"
            WHERE d."projectId" = %s
              AND dc.embedding IS NOT NULL
            ORDER BY dc.embedding::vector <=> %s::vector
            LIMIT %s
        """

        conn = self._get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                embedding_str = f'[{",".join(str(x) for x in query_embedding)}]'
                cur.execute(sql, (embedding_str, project_id, embedding_str, top_k))
                rows = cur.fetchall()
        finally:
            conn.close()

        results = []
        for row in rows:
            similarity = float(row.get('similarity', 0))
            if similarity >= score_threshold:
                results.append({
                    'id': str(row['id']),
                    'documentId': str(row['documentId']),
                    'documentTitle': row['documentTitle'],
                    'chunkIndex': row['chunkIndex'],
                    'content': row['content'],
                    'tokenCount': row['tokenCount'],
                    'similarity': similarity,
                })

        return results
