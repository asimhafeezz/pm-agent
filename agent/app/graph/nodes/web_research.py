from __future__ import annotations

import json
import re
from typing import Any, Dict, List

from app.graph.services import GraphServices
from app.graph.nodes.common import emit_event
from app.graph.state import AgentState


_QUERY_GEN_SYSTEM = (
    "You generate targeted web search queries for financial investment research.\n"
    "Given a stock symbol and user question, produce 3-5 search queries that will find:\n"
    "- Current analyst opinions and ratings\n"
    "- Recent company developments and outlook\n"
    "- Risk factors and bear case arguments\n"
    "- Competitive positioning and market share\n"
    "- Forward guidance and growth expectations\n\n"
    "Return ONLY a JSON array of query strings. No explanation.\n"
    'Example: ["AAPL investment outlook 2026", "Apple risks regulatory concerns", "AAPL vs competitors market share"]'
)


def web_research_node(services: GraphServices):
    """Node that performs web research via Tavily for deep analysis."""

    async def _node(state: AgentState) -> Dict[str, Any]:
        await emit_event(services, state, 'web_research_progress', {
            'queriesCompleted': 0,
            'totalQueries': 0,
            'currentQuery': 'Generating search queries...',
        })

        tavily = services.tavily_client
        if not tavily:
            return {
                'webResearch': {'results': [], 'error': 'tavily_unavailable'},
                'warnings': list(state.get('warnings', [])) + ['web_research_skipped:tavily_unavailable'],
            }

        symbols = [c['symbol'] for c in state.get('resolvedCandidates', []) if c.get('symbol')]
        question = state.get('question', '')

        if not symbols:
            return {'webResearch': {'results': [], 'queries': []}}

        # Generate targeted search queries using LLM
        queries = await _generate_queries(services, symbols, question)

        if not queries:
            # Fallback: generate basic queries from symbols
            queries = _fallback_queries(symbols, question)

        total = len(queries)
        await emit_event(services, state, 'web_research_progress', {
            'queriesCompleted': 0,
            'totalQueries': total,
            'currentQuery': queries[0] if queries else '',
        })

        # Execute all searches
        search_results = await tavily.batch_search(queries, max_results=3)

        # Emit final progress
        await emit_event(services, state, 'web_research_progress', {
            'queriesCompleted': total,
            'totalQueries': total,
            'currentQuery': 'Complete',
        })

        # Deduplicate results by URL
        seen_urls = set()
        deduplicated: List[Dict[str, Any]] = []
        for batch in search_results:
            for result in batch.get('results', []):
                url = result.get('url', '')
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    deduplicated.append({
                        'title': result.get('title', ''),
                        'url': url,
                        'content': result.get('content', '')[:500],
                        'score': result.get('score', 0),
                        'query': batch.get('query', ''),
                    })

        # Sort by relevance score
        deduplicated.sort(key=lambda x: x.get('score', 0), reverse=True)

        # Collect Tavily answers
        answers = [
            {'query': b.get('query', ''), 'answer': b['answer']}
            for b in search_results
            if b.get('answer')
        ]

        web_research = {
            'results': deduplicated[:20],
            'answers': answers,
            'queries': queries,
            'totalResults': len(deduplicated),
        }

        # Emit as tool result for frontend
        await services.event_bus.emit(state['runId'], 'tool_result', {
            'tool': 'web_research',
            'request': {'queries': queries},
            'result': {'totalResults': len(deduplicated), 'answersCount': len(answers)},
        })

        return {'webResearch': web_research}

    return _node


async def _generate_queries(services: GraphServices, symbols: List[str], question: str) -> List[str]:
    """Use LLM to generate targeted search queries."""
    symbol_str = ', '.join(symbols)
    user_prompt = (
        f"Symbols: {symbol_str}\n"
        f"User question: {question}\n\n"
        f"Generate 3-5 targeted search queries for deep investment research on these symbols."
    )

    try:
        response = await services.llm_client.chat(
            system=_QUERY_GEN_SYSTEM,
            user=user_prompt,
            temperature=0.0,
            max_tokens=300,
        )
        content = response.get('content', '').strip()

        # Parse JSON array
        parsed = None
        try:
            parsed = json.loads(content)
        except (json.JSONDecodeError, ValueError):
            match = re.search(r'\[.*\]', content, re.DOTALL)
            if match:
                try:
                    parsed = json.loads(match.group(0))
                except (json.JSONDecodeError, ValueError):
                    pass

        if isinstance(parsed, list):
            return [str(q) for q in parsed if isinstance(q, str)][:5]
    except Exception:
        pass

    return []


def _fallback_queries(symbols: List[str], question: str) -> List[str]:
    """Generate basic queries without LLM."""
    queries = []
    for symbol in symbols[:2]:
        queries.append(f"{symbol} stock investment analysis outlook")
        queries.append(f"{symbol} risks concerns bear case")
        queries.append(f"{symbol} analyst rating recommendation")
    return queries[:5]
