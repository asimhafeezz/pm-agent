from __future__ import annotations

import logging
from typing import Any, Dict

from app.graph.services import GraphServices
from app.graph.state import AgentState

logger = logging.getLogger(__name__)


def retrieve_docs_node(services: GraphServices):
    async def _node(state: AgentState) -> Dict[str, Any]:
        project_id = state.get('projectId')
        question = state.get('question', '')

        if not project_id or not services.doc_retriever:
            logger.info('[%s] Skipping doc retrieval: no projectId or retriever', state.get('runId', '?'))
            return {'retrievedDocuments': []}

        try:
            results = await services.doc_retriever.retrieve(
                query=question,
                project_id=project_id,
                top_k=5,
            )
            logger.info(
                '[%s] Retrieved %d document chunks (project=%s)',
                state.get('runId', '?'),
                len(results),
                project_id,
            )
            return {'retrievedDocuments': results}
        except Exception as exc:
            logger.error('[%s] Doc retrieval failed: %s', state.get('runId', '?'), exc)
            return {
                'retrievedDocuments': [],
                'warnings': (state.get('warnings') or []) + [f'Document retrieval failed: {exc}'],
            }

    return _node
