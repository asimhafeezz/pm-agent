from __future__ import annotations

import logging
from typing import Any, Dict

from app.graph.services import GraphServices
from app.graph.nodes.common import emit_event
from app.graph.state import AgentState

logger = logging.getLogger(__name__)


def load_user_node(services: GraphServices):
    async def _node(state: AgentState) -> Dict[str, Any]:
        user_context = state.get('userContext') or {}
        auth_token = state.get('authToken')
        conversation_id = (state.get('metadata') or {}).get('conversationId')
        run_id = state.get('runId', 'unknown')

        # If userContext is missing, attempt to fetch it
        if not user_context or not isinstance(user_context, dict):
            logger.warning('[%s] userContext is missing or invalid, attempting recovery...', run_id)
            if auth_token:
                try:
                    user_context = await services.app_api_client.get_user_context(
                        conversation_id, auth_token,
                    )
                    if user_context:
                        logger.info('[%s] Successfully recovered userContext', run_id)
                    else:
                        logger.warning('[%s] get_user_context returned empty', run_id)
                        user_context = {}
                except Exception as exc:
                    logger.error('[%s] Failed to fetch userContext: %s', run_id, exc)
                    user_context = {}
            else:
                logger.warning('[%s] No auth token available to fetch userContext', run_id)
                user_context = {}

        has_profile = bool(user_context.get('profile'))

        await emit_event(services, state, 'loaded_user', {
            'hasProfile': has_profile,
            'projectId': state.get('projectId'),
        })

        return {
            'userContext': user_context,
        }

    return _node
