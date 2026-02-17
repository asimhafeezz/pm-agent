# DEPRECATED: This builder is superseded by unified_builder.py.
# Use build_graph(services, execution_mode='thinking', deep_analysis=True) instead.
# This file will be removed in a future version.

from __future__ import annotations

import asyncio
from typing import Any, Dict

from langgraph.graph import END, StateGraph

from app.graph.state import AgentState
from app.graph.nodes.build_candidates import build_candidates_node
from app.graph.nodes.classify_news import classify_news_node
from app.graph.nodes.fetch_all_data import fetch_all_data_node
from app.graph.nodes.load_user import load_user_node
from app.graph.nodes.parse_intent import parse_intent_node
from app.graph.nodes.generate_title import generate_title_node
from app.graph.nodes.update_memory import update_memory_node
from app.graph.nodes.persist import persist_node
from app.graph.nodes.resolve_symbols import resolve_symbols_node
from app.graph.nodes.search_memories import search_memories_node
from app.graph.nodes.store_memories import store_memories_node
from app.graph.nodes.web_research import web_research_node
from app.graph.nodes.deep_score_decide import deep_score_decide_node
from app.graph.nodes.synthesize_report import synthesize_report_node
from app.graph.nodes.common import emit_event
from app.graph.services import GraphServices


def _thinking_deep_route_by_intent(state: AgentState) -> str:
    """Route based on intent — thinking + deep analysis always goes through full pipeline."""
    required = state.get('requiredDataSources', [])

    # No data needed — skip to report synthesis
    if not required:
        return 'synthesize_report'

    return 'build_candidates'


def _make_fetch_thinking_deep_data_node(services: GraphServices):
    """Create a composite node that runs fetch_all_data + web_research in parallel for thinking + deep mode."""

    _fetch_all = fetch_all_data_node(services)
    _web_research = web_research_node(services)

    async def _node(state: AgentState) -> Dict[str, Any]:
        await emit_event(services, state, 'collecting_data', {
            'sources': ['market', 'fundamentals', 'news', 'events', 'web'],
        })

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
                warnings.append(f'thinking_deep_fetch_error: {result}')
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


def build_thinking_deep_graph(services: GraphServices):
    """Build the thinking + deep analysis LangGraph pipeline (web research + structured report)."""
    graph = StateGraph(AgentState)

    # --- Reused nodes ---
    graph.add_node('load_user', load_user_node(services))
    graph.add_node('search_memories', search_memories_node(services))
    graph.add_node('parse_intent', parse_intent_node(services))
    graph.add_node('build_candidates', build_candidates_node(services))
    graph.add_node('resolve_symbols', resolve_symbols_node(services))

    # --- Thinking + deep analysis: parallel fetch (all data + web research) ---
    graph.add_node('fetch_thinking_deep_data', _make_fetch_thinking_deep_data_node(services))
    graph.add_node('classify_news', classify_news_node(services))

    # --- Deep analysis specific nodes ---
    graph.add_node('deep_score_decide', deep_score_decide_node(services))
    graph.add_node('synthesize_report', synthesize_report_node(services))

    # --- Post-response (reused) ---
    graph.add_node('generate_title', generate_title_node(services))
    graph.add_node('update_memory', update_memory_node(services))
    graph.add_node('store_memories', store_memories_node(services))
    graph.add_node('persist', persist_node(services))

    # === EDGES ===

    # Entry: load user → search memories → parse intent
    graph.set_entry_point('load_user')
    graph.add_edge('load_user', 'search_memories')
    graph.add_edge('search_memories', 'parse_intent')

    # Intent-based routing
    graph.add_conditional_edges('parse_intent', _thinking_deep_route_by_intent, {
        'synthesize_report': 'synthesize_report',
        'build_candidates': 'build_candidates',
    })

    # Data pipeline: candidates → resolve → parallel thinking+deep fetch
    graph.add_edge('build_candidates', 'resolve_symbols')
    graph.add_edge('resolve_symbols', 'fetch_thinking_deep_data')

    # After thinking+deep fetch: classify news → deep scoring → report
    graph.add_edge('fetch_thinking_deep_data', 'classify_news')
    graph.add_edge('classify_news', 'deep_score_decide')
    graph.add_edge('deep_score_decide', 'synthesize_report')

    # Post-response: all paths converge
    graph.add_edge('synthesize_report', 'generate_title')
    graph.add_edge('generate_title', 'update_memory')
    graph.add_edge('update_memory', 'store_memories')
    graph.add_edge('store_memories', 'persist')
    graph.add_edge('persist', END)

    return graph.compile()
