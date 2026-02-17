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

        # Validate key fields
        has_profile = bool(user_context.get('profile'))
        has_summary = bool(user_context.get('summary'))
        has_holdings = bool(user_context.get('portfolioHoldings'))

        if not has_summary:
            logger.warning('[%s] userContext missing "summary" field', run_id)
        if not has_profile:
            logger.warning('[%s] userContext missing "profile" field', run_id)

        # Extract holding symbols for downstream nodes (e.g., portfolio_question enrichment)
        holding_symbols: list[str] = []
        holdings = user_context.get('portfolioHoldings') or []
        if isinstance(holdings, list):
            for h in holdings:
                if isinstance(h, dict) and h.get('symbol'):
                    holding_symbols.append(str(h['symbol']).upper())
            if holding_symbols:
                logger.info('[%s] User has %d holdings: %s', run_id, len(holdings), holding_symbols)

        await emit_event(services, state, 'loaded_user', {
            'hasProfile': has_profile,
            'hasHoldings': has_holdings,
            'holdingCount': len(holdings),
            'holdingSymbols': holding_symbols,
        })

        constraints = [
            {'type': 'budget', 'value': 0},
        ]

        return {
            'userContext': user_context,
            'userHoldingSymbols': holding_symbols,
            'constraints': constraints,
        }

    return _node
