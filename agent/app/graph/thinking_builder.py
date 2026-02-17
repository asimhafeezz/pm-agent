# DEPRECATED: This builder is superseded by unified_builder.py.
# Use build_graph(services, execution_mode='thinking', deep_analysis=False) instead.
# This file will be removed in a future version.

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
from app.graph.nodes.common import emit_event
from app.graph.services import GraphServices


def _route_by_intent(state: AgentState) -> str:
    """Route to the appropriate pipeline branch based on classified intent."""
    required = state.get('requiredDataSources', [])

    # No data needed — skip straight to response generation
    if not required:
        return 'explain_format'

    # All data-requiring intents go through the data pipeline
    return 'build_candidates'


def _route_after_resolve(state: AgentState) -> str:
    """Route to the appropriate fetch path based on required data sources."""
    required = set(state.get('requiredDataSources', []))

    if not required:
        return 'explain_format'

    # Check if web research is required
    has_web = 'web' in required
    non_web = required - {'web'}

    # Web + full data path
    if has_web and non_web:
        return 'fetch_thinking_data'

    # Web-only path
    if has_web and not non_web:
        return 'fetch_web_only'

    # Price-only path (skip fundamentals, news, scoring)
    if non_web == {'market'}:
        return 'fetch_market_only'

    # News-only path (skip market, fundamentals, scoring)
    if non_web == {'news'}:
        return 'fetch_news_only'

    # Full analysis without web: parallel fetch of all data sources
    return 'fetch_all_data'


def _make_fetch_thinking_data_node(services: GraphServices):
    """Create a composite node that runs fetch_all_data + web_research in parallel for thinking mode."""

    _fetch_all = fetch_all_data_node(services)
    _web_research = web_research_node(services)

    async def _node(state: AgentState) -> Dict[str, Any]:
        # Run both data collection pipelines in parallel
        results = await asyncio.gather(
            _fetch_all(state),
            _web_research(state),
            return_exceptions=True,
        )

        merged: Dict[str, Any] = {}
        warnings = list(state.get('warnings', []))

        for result in results:
            if isinstance(result, Exception):
                warnings.append(f'thinking_fetch_error: {result}')
            elif isinstance(result, dict):
                # Merge warnings from sub-results
                sub_warnings = result.pop('warnings', None)
                if isinstance(sub_warnings, list):
                    warnings.extend(sub_warnings)
                merged.update(result)

        if warnings:
            merged['warnings'] = warnings

        return merged

    return _node


def build_thinking_graph(services: GraphServices):
    """Build the thinking mode graph with web research but conversational output."""
    graph = StateGraph(AgentState)

    # --- Core nodes ---
    graph.add_node('load_user', load_user_node(services))
    graph.add_node('search_memories', search_memories_node(services))
    graph.add_node('parse_intent', parse_intent_node(services))
    graph.add_node('build_candidates', build_candidates_node(services))
    graph.add_node('resolve_symbols', resolve_symbols_node(services))

    # --- Thinking mode: parallel fetch (all data + web research) ---
    graph.add_node('fetch_thinking_data', _make_fetch_thinking_data_node(services))
    graph.add_node('classify_news', classify_news_node(services))
    graph.add_node('score_decide', score_decide_node(services))

    # --- Shortcut path nodes (separate instances to avoid edge conflicts) ---
    graph.add_node('fetch_all_data', fetch_all_data_node(services))
    graph.add_node('classify_news_after_all', classify_news_node(services))
    graph.add_node('score_decide_after_all', score_decide_node(services))

    graph.add_node('fetch_market_only', fetch_market_node(services))
    graph.add_node('fetch_news_only', fetch_news_node(services))
    graph.add_node('classify_news_only', classify_news_node(services))
    graph.add_node('fetch_web_only', web_research_node(services))

    # --- Response + post-processing ---
    graph.add_node('explain_format', explain_format_node(services))
    graph.add_node('generate_title', generate_title_node(services))
    graph.add_node('update_memory', update_memory_node(services))
    graph.add_node('store_memories', store_memories_node(services))
    graph.add_node('persist', persist_node(services))

    # === EDGES ===

    # Entry: always load user → search memories → parse intent
    graph.set_entry_point('load_user')
    graph.add_edge('load_user', 'search_memories')
    graph.add_edge('search_memories', 'parse_intent')

    # Intent-based routing
    graph.add_conditional_edges('parse_intent', _route_by_intent, {
        'explain_format': 'explain_format',
        'build_candidates': 'build_candidates',
    })

    # Data pipeline: candidates → resolve → route by data needs
    graph.add_edge('build_candidates', 'resolve_symbols')
    graph.add_conditional_edges('resolve_symbols', _route_after_resolve, {
        'fetch_thinking_data': 'fetch_thinking_data',  # Web + all data
        'fetch_all_data': 'fetch_all_data',            # No web, all data
        'fetch_web_only': 'fetch_web_only',            # Web only
        'fetch_market_only': 'fetch_market_only',      # Price only
        'fetch_news_only': 'fetch_news_only',          # News only
        'explain_format': 'explain_format',            # No data
    })

    # Path A: Thinking mode (parallel fetch with web → classify → score → explain)
    graph.add_edge('fetch_thinking_data', 'classify_news')
    graph.add_edge('classify_news', 'score_decide')
    graph.add_edge('score_decide', 'explain_format')

    # Path B: Full analysis without web (fetch all → classify → score → explain)
    graph.add_edge('fetch_all_data', 'classify_news_after_all')
    graph.add_edge('classify_news_after_all', 'score_decide_after_all')
    graph.add_edge('score_decide_after_all', 'explain_format')

    # Path C: Price-only (fetch market → explain)
    graph.add_edge('fetch_market_only', 'explain_format')

    # Path D: News-only (fetch news → classify → explain)
    graph.add_edge('fetch_news_only', 'classify_news_only')
    graph.add_edge('classify_news_only', 'explain_format')

    # Path E: Web-only (fetch web → explain)
    graph.add_edge('fetch_web_only', 'explain_format')

    # Post-response: all paths converge
    graph.add_edge('explain_format', 'generate_title')
    graph.add_edge('generate_title', 'update_memory')
    graph.add_edge('update_memory', 'store_memories')
    graph.add_edge('store_memories', 'persist')
    graph.add_edge('persist', END)

    return graph.compile()
