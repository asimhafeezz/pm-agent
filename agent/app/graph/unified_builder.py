from __future__ import annotations

import asyncio
from typing import Any, Dict

from langgraph.graph import END, StateGraph

from app.graph.state import AgentState
from app.graph.nodes.build_candidates import build_candidates_node
from app.graph.nodes.classify_news import classify_news_node
from app.graph.nodes.explain_format import explain_format_node
from app.graph.nodes.fetch_all_data import fetch_all_data_node
from app.graph.nodes.fetch_market import fetch_market_node
from app.graph.nodes.fetch_news import fetch_news_node
from app.graph.nodes.load_user import load_user_node
from app.graph.nodes.parse_intent import parse_intent_node
from app.graph.nodes.generate_title import generate_title_node
from app.graph.nodes.update_memory import update_memory_node
from app.graph.nodes.persist import persist_node
from app.graph.nodes.resolve_symbols import resolve_symbols_node
from app.graph.nodes.score_decide import score_decide_node
from app.graph.nodes.search_memories import search_memories_node
from app.graph.nodes.store_memories import store_memories_node
from app.graph.nodes.web_research import web_research_node
from app.graph.nodes.deep_score_decide import deep_score_decide_node
from app.graph.nodes.synthesize_report import synthesize_report_node
from app.graph.nodes.trading import trading_node
from app.graph.nodes.common import emit_event
from app.graph.services import GraphServices


# ---------------------------------------------------------------------------
# Helper factories
# ---------------------------------------------------------------------------


def _make_parallel_fetch_node(services: GraphServices, label: str = 'parallel'):
    """Create a composite node that runs fetch_all_data + web_research in parallel."""

    _fetch_all = fetch_all_data_node(services)
    _web_research = web_research_node(services)

    async def _node(state: AgentState) -> Dict[str, Any]:
        await emit_event(services, state, 'collecting_data', {
            'sources': ['market', 'fundamentals', 'news', 'events', 'web'],
        })

        results = await asyncio.gather(
            _fetch_all(state),
            _web_research(state),
            return_exceptions=True,
        )

        merged: Dict[str, Any] = {}
        warnings = list(state.get('warnings', []))

        for result in results:
            if isinstance(result, Exception):
                warnings.append(f'{label}_fetch_error: {result}')
            elif isinstance(result, dict):
                sub_warnings = result.pop('warnings', None)
                if isinstance(sub_warnings, list):
                    warnings.extend(sub_warnings)
                merged.update(result)

        if warnings:
            merged['warnings'] = warnings

        return merged

    return _node


def _make_intent_router(response_node_name: str):
    """Return a routing function that skips to response when no data is needed."""

    def _route(state: AgentState) -> str:
        if state.get('intentType') == 'trading':
            return 'trading_node'
        if state.get('intentType') in ('deposit_withdraw', 'goal_management'):
            return response_node_name
        required = state.get('requiredDataSources', [])
        if not required:
            return response_node_name
        return 'build_candidates'

    return _route


def _make_resolve_router(
    execution_mode: str,
    deep_analysis: bool,
    response_node_name: str,
):
    """Return the appropriate post-resolve routing function based on mode."""

    if deep_analysis:
        # Deep modes: always go through parallel fetch (linear path)
        def _route(_state: AgentState) -> str:
            return 'fetch_parallel_data'
        return _route

    if execution_mode == 'thinking':
        # Thinking (non-deep): 5 paths
        def _route(state: AgentState) -> str:
            required = set(state.get('requiredDataSources', []))
            if not required:
                return response_node_name
            has_web = 'web' in required
            non_web = required - {'web'}
            if has_web and non_web:
                return 'fetch_thinking_data'
            if has_web and not non_web:
                return 'fetch_web_only'
            if non_web == {'market'}:
                return 'fetch_market_only'
            if non_web == {'news'}:
                return 'fetch_news_only'
            return 'fetch_all_data'
        return _route

    # Quick (non-deep): 3 paths
    def _route(state: AgentState) -> str:
        required = set(state.get('requiredDataSources', []))
        if not required:
            return response_node_name
        if required == {'market'}:
            return 'fetch_market_only'
        if required == {'news'}:
            return 'fetch_news_only'
        return 'fetch_all_data'
    return _route


# ---------------------------------------------------------------------------
# Unified graph builder
# ---------------------------------------------------------------------------


def build_graph(
    services: GraphServices,
    execution_mode: str = 'quick',
    deep_analysis: bool = False,
):
    """Build the agent LangGraph pipeline for any mode combination.

    Args:
        services: Shared graph services (LLM, API clients, event bus, etc.).
        execution_mode: 'quick' or 'thinking'.
        deep_analysis: Whether to run deep analysis (web research + structured report).

    Returns:
        Compiled LangGraph runnable.
    """
    graph = StateGraph(AgentState)

    # ── 1. Determine score & response nodes based on deep_analysis ──

    if deep_analysis:
        score_node_name = 'deep_score_decide'
        score_node_fn = deep_score_decide_node(services)
        response_node_name = 'synthesize_report'
        response_node_fn = synthesize_report_node(services)
    else:
        score_node_name = 'score_decide'
        score_node_fn = score_decide_node(services)
        response_node_name = 'explain_format'
        response_node_fn = explain_format_node(services)

    # ── 2. Add common entry nodes ──

    graph.add_node('load_user', load_user_node(services))
    graph.add_node('search_memories', search_memories_node(services))
    graph.add_node('parse_intent', parse_intent_node(services))
    graph.add_node('build_candidates', build_candidates_node(services))
    graph.add_node('resolve_symbols', resolve_symbols_node(services))

    # ── 3. Add response + post-processing nodes ──

    graph.add_node(response_node_name, response_node_fn)
    graph.add_node('generate_title', generate_title_node(services))
    graph.add_node('update_memory', update_memory_node(services))
    graph.add_node('store_memories', store_memories_node(services))
    graph.add_node('persist', persist_node(services))
    graph.add_node('trading_node', trading_node(services))

    # ── 4. Add data pipeline nodes (mode-dependent) ──

    if deep_analysis:
        # Deep modes: single parallel fetch → classify → deep_score → response
        graph.add_node('fetch_parallel_data', _make_parallel_fetch_node(services, 'deep'))
        graph.add_node('classify_news', classify_news_node(services))
        graph.add_node(score_node_name, score_node_fn)

    elif execution_mode == 'thinking':
        # Thinking (non-deep): 5 paths including web research
        graph.add_node('fetch_thinking_data', _make_parallel_fetch_node(services, 'thinking'))
        graph.add_node('classify_news', classify_news_node(services))
        graph.add_node(score_node_name, score_node_fn)

        # Non-web full-data path needs separate classify/score instances
        graph.add_node('fetch_all_data', fetch_all_data_node(services))
        graph.add_node('classify_news_after_all', classify_news_node(services))
        graph.add_node('score_decide_after_all', score_decide_node(services))

        # Shortcut paths
        graph.add_node('fetch_market_only', fetch_market_node(services))
        graph.add_node('fetch_news_only', fetch_news_node(services))
        graph.add_node('classify_news_only', classify_news_node(services))
        graph.add_node('fetch_web_only', web_research_node(services))

    else:
        # Quick (non-deep): 3 paths, no web research
        graph.add_node('fetch_all_data', fetch_all_data_node(services))
        graph.add_node('classify_news', classify_news_node(services))
        graph.add_node(score_node_name, score_node_fn)

        graph.add_node('fetch_market_only', fetch_market_node(services))
        graph.add_node('fetch_news_only', fetch_news_node(services))
        graph.add_node('classify_news_only', classify_news_node(services))

    # ── 5. Wire entry edges ──

    graph.set_entry_point('load_user')
    graph.add_edge('load_user', 'search_memories')
    graph.add_edge('search_memories', 'parse_intent')

    # ── 6. Intent-based routing ──

    intent_router = _make_intent_router(response_node_name)
    intent_edge_map = {
        response_node_name: response_node_name,
        'build_candidates': 'build_candidates',
        'trading_node': 'trading_node',
    }
    graph.add_conditional_edges('parse_intent', intent_router, intent_edge_map)

    # ── 7. Data pipeline: candidates → resolve → mode-dependent routing ──

    graph.add_edge('build_candidates', 'resolve_symbols')

    resolve_router = _make_resolve_router(execution_mode, deep_analysis, response_node_name)

    if deep_analysis:
        # Linear path after resolve
        graph.add_conditional_edges('resolve_symbols', resolve_router, {
            'fetch_parallel_data': 'fetch_parallel_data',
        })
        graph.add_edge('fetch_parallel_data', 'classify_news')
        graph.add_edge('classify_news', score_node_name)
        graph.add_edge(score_node_name, response_node_name)

    elif execution_mode == 'thinking':
        # 5-path routing
        graph.add_conditional_edges('resolve_symbols', resolve_router, {
            'fetch_thinking_data': 'fetch_thinking_data',
            'fetch_all_data': 'fetch_all_data',
            'fetch_web_only': 'fetch_web_only',
            'fetch_market_only': 'fetch_market_only',
            'fetch_news_only': 'fetch_news_only',
            response_node_name: response_node_name,
        })

        # Path A: Thinking (parallel fetch with web → classify → score → response)
        graph.add_edge('fetch_thinking_data', 'classify_news')
        graph.add_edge('classify_news', score_node_name)
        graph.add_edge(score_node_name, response_node_name)

        # Path B: Full analysis without web
        graph.add_edge('fetch_all_data', 'classify_news_after_all')
        graph.add_edge('classify_news_after_all', 'score_decide_after_all')
        graph.add_edge('score_decide_after_all', response_node_name)

        # Path C: Price-only
        graph.add_edge('fetch_market_only', response_node_name)

        # Path D: News-only
        graph.add_edge('fetch_news_only', 'classify_news_only')
        graph.add_edge('classify_news_only', response_node_name)

        # Path E: Web-only
        graph.add_edge('fetch_web_only', response_node_name)

    else:
        # Quick: 3-path routing
        graph.add_conditional_edges('resolve_symbols', resolve_router, {
            'fetch_all_data': 'fetch_all_data',
            'fetch_market_only': 'fetch_market_only',
            'fetch_news_only': 'fetch_news_only',
            response_node_name: response_node_name,
        })

        # Path A: Full analysis
        graph.add_edge('fetch_all_data', 'classify_news')
        graph.add_edge('classify_news', score_node_name)
        graph.add_edge(score_node_name, response_node_name)

        # Path B: Price-only
        graph.add_edge('fetch_market_only', response_node_name)

        # Path C: News-only
        graph.add_edge('fetch_news_only', 'classify_news_only')
        graph.add_edge('classify_news_only', response_node_name)

    # ── 8. Post-response tail (all paths converge) ──

    graph.add_edge(response_node_name, 'generate_title')
    graph.add_edge('trading_node', 'generate_title')
    graph.add_edge('generate_title', 'update_memory')
    graph.add_edge('update_memory', 'store_memories')
    graph.add_edge('store_memories', 'persist')
    graph.add_edge('persist', END)

    return graph.compile()
