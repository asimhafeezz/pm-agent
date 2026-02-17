from __future__ import annotations

import json
import re
from typing import Any, Dict

from app.graph.services import GraphServices
from app.graph.nodes.common import emit_event
from app.graph.nodes.explain_format import (
    _build_financial_context, _build_price_chart, _build_news_cards,
    _calculate_position_size, _extract_quote, _to_float,
)
from app.graph.state import AgentState


_REPORT_SYSTEM = (
    "You are Finly, writing a comprehensive investment analysis report. "
    "Generate a structured deep analysis covering multiple dimensions.\n\n"
    "Return ONLY valid JSON with this structure:\n"
    "{\n"
    '  "title": "Short descriptive title focused ONLY on the asset/topic being analyzed. Examples: \'AAPL: Q4 2024 Performance Review\', \'Tech Giants Comparison\', \'Bitcoin Market Analysis\', \'S&P 500 Technical Outlook\'. NEVER include user profile details, risk levels, or personal preferences in the title. Keep it objective and asset-focused.",\n'
    '  "summary": "2-3 sentence executive summary with key takeaway",\n'
    '  "sections": [\n'
    '    {\n'
    '      "id": "fundamentals",\n'
    '      "title": "Fundamental Analysis",\n'
    '      "content": "2-4 paragraphs in markdown analyzing financial health, valuation, growth...",\n'
    '      "score": 0.0-1.0\n'
    '    },\n'
    '    {\n'
    '      "id": "sentiment",\n'
    '      "title": "Market Sentiment & News",\n'
    '      "content": "2-3 paragraphs in markdown on news sentiment, analyst opinions, web research...",\n'
    '      "score": 0.0-1.0\n'
    '    },\n'
    '    {\n'
    '      "id": "price_action",\n'
    '      "title": "Price Action",\n'
    '      "content": "1-2 paragraphs on recent price movement and momentum...",\n'
    '      "score": 0.0-1.0\n'
    '    },\n'
    '    {\n'
    '      "id": "risks",\n'
    '      "title": "Key Risks",\n'
    '      "content": "Bullet list of 3-5 key risk factors with brief explanation..."\n'
    '    },\n'
    '    {\n'
    '      "id": "verdict",\n'
    '      "title": "Final Verdict",\n'
    '      "content": "1-2 paragraphs with actionable conclusion and next steps..."\n'
    '    }\n'
    '  ],\n'
    '  "conversationalAnswer": "2-4 sentence conversational summary for the chat"\n'
    "}\n\n"
    "IMPORTANT:\n"
    "- Use ONLY the provided data. Never invent prices, metrics, or statistics.\n"
    "- Be specific with numbers when available.\n"
    "- Each section should provide genuine analysis, not just restate data.\n"
    "- The conversationalAnswer should be a natural, concise summary.\n"
    "- Use markdown formatting in content (bold, bullets, etc).\n"
    "Return ONLY the JSON."
)


def synthesize_report_node(services: GraphServices):
    """Generate a structured deep analysis report from all collected data."""

    async def _node(state: AgentState) -> Dict[str, Any]:
        await emit_event(services, state, 'analyzing', {'step': 'report'})

        question = state.get('question', '')
        user_context = state.get('userContext', {}) or {}
        decision = state.get('decision') or {}
        scores = state.get('scores') or {}
        web_research = state.get('webResearch') or {}

        # Build comprehensive context for LLM
        financial_context = _build_financial_context(state)

        # Add web research findings
        web_context = _build_web_context(web_research)

        # Build user context summary
        user_summary = user_context.get('summary', '')
        profile = user_context.get('profile') or {}

        user_prompt_parts = []
        if user_summary:
            user_prompt_parts.append(f"About the user:\n{user_summary}")

        if financial_context:
            user_prompt_parts.append(financial_context)

        if web_context:
            user_prompt_parts.append(web_context)

        # Add decision context
        if decision:
            user_prompt_parts.append(
                f"Heuristic recommendation: {decision.get('action', 'N/A').upper()} "
                f"(confidence: {decision.get('confidence', 0):.2f})\n"
                f"Risks identified: {', '.join(decision.get('risks', [])) or 'None'}"
            )

        # Add score breakdown
        if scores:
            score_lines = []
            for symbol, s in scores.items():
                score_lines.append(
                    f"{symbol}: confidence={s.get('confidence', 0):.2f}, "
                    f"fundamentals={s.get('fundamentalsScore', 0):.2f}, "
                    f"sentiment={s.get('sentimentScore', 0):.2f}, "
                    f"webSentiment={s.get('webSentimentScore', 0):.2f}, "
                    f"price={s.get('priceContextScore', 0):.2f}"
                )
            user_prompt_parts.append("Score breakdown:\n" + "\n".join(score_lines))

        user_prompt_parts.append(f"User question: {question}")

        user_prompt = "\n\n".join(user_prompt_parts)

        # Generate the report
        try:
            response = await services.llm_client.chat(
                system=_REPORT_SYSTEM,
                user=user_prompt.strip(),
                temperature=0.2,
                max_tokens=8192,
            )
            content = response.get('content', '').strip()
            report = _parse_report(content)
        except Exception as exc:
            report = _fallback_report(state, str(exc))

        # Build the deep report structure
        symbols = [c['symbol'] for c in state.get('resolvedCandidates', []) if c.get('symbol')]
        primary_symbol = symbols[0] if symbols else ''

        # Build score breakdown for the UI
        score_breakdown = {}
        if primary_symbol and primary_symbol in scores:
            s = scores[primary_symbol]
            score_breakdown = {
                'suitability': s.get('suitabilityScore', 0),
                'fundamentals': s.get('fundamentalsScore', 0),
                'sentiment': s.get('sentimentScore', 0),
                'webSentiment': s.get('webSentimentScore', 0),
                'priceContext': s.get('priceContextScore', 0),
            }

        # Build sources list
        sources = _build_sources(state, web_research)

        deep_report = {
            'title': report.get('title', f'{primary_symbol} Analysis' if primary_symbol else 'Investment Analysis'),
            'summary': report.get('summary', ''),
            'recommendation': {
                'action': decision.get('action', 'wait'),
                'confidence': decision.get('confidence', 0),
                'reasoning': decision.get('llmReasoning', ''),
            },
            'sections': report.get('sections', []),
            'scoreBreakdown': score_breakdown,
            'sources': sources,
            'symbol': primary_symbol,
        }

        # Build visualization
        visualization = {
            'type': 'deep_analysis',
            'symbol': primary_symbol,
            'title': deep_report['title'],
            'recommendation': deep_report['recommendation'],
            'scoreBreakdown': score_breakdown,
            'sections': report.get('sections', []),
            'sources': sources,
        }

        # Also include price chart data if available
        if primary_symbol:
            price_chart = _build_price_chart(state, primary_symbol)
            if price_chart:
                visualization['priceChart'] = price_chart

        # Add position sizing for buy/sell recommendations
        rec_action = str(decision.get('action', '')).lower()
        if rec_action in ('buy', 'sell') and primary_symbol:
            prices = state.get('prices') or {}
            quote = _extract_quote(prices, primary_symbol)
            current_price = (
                _to_float(quote.get('close'))
                or _to_float(quote.get('price'))
                or _to_float(quote.get('last'))
            )
            suggested_qty = _calculate_position_size(
                user_context, primary_symbol, current_price, rec_action,
            )
            # Calculate spend amount and determine amount type
            if suggested_qty > 0 and current_price and current_price > 0:
                suggested_amount = round(suggested_qty * current_price, 2)
                amount_type = 'usd'
            else:
                suggested_amount = None
                amount_type = 'shares'
            
            # Determine risk level label for reasoning
            risk_level = str((user_context.get('profile') or {}).get('riskLevel', 'moderate')).lower()
            max_pct_map = {'conservative': 2, 'moderate': 5, 'aggressive': 8}
            max_pct = max_pct_map.get(risk_level, 5)
            holdings = user_context.get('portfolioHoldings') or []
            portfolio_val = sum(
                float(h.get('units', 0)) * float(h.get('avgBuyPrice', 0))
                for h in holdings if isinstance(h, dict)
            )
            if portfolio_val <= 0:
                portfolio_val = 10000
            sizing_reason = f"{max_pct}% of ${portfolio_val:,.0f} portfolio · {risk_level} risk"
            
            # Get asset type from resolved candidate
            candidates = state.get('resolvedCandidates') or []
            primary_candidate = next((c for c in candidates if c.get('symbol') == primary_symbol), None)
            asset_type = primary_candidate.get('assetType', 'STOCK') if primary_candidate else 'STOCK'

            visualization['positionSizing'] = {
                'suggestedQty': suggested_qty,
                'suggestedAmount': suggested_amount,
                'currentPrice': current_price,
                'maxPositionPct': max_pct,
                'reasoning': sizing_reason,
                'reasoning': sizing_reason,
                'assetType': asset_type,
                'amountType': amount_type,
            }

        final_answer = report.get('conversationalAnswer', '') or report.get('summary', '')

        # Emit response_ready so UI shows the answer while background nodes complete
        await emit_event(services, state, 'response_ready', {
            'finalAnswer': final_answer,
            'visualization': visualization,
            'decision': decision,
            'prices': state.get('prices'),
            'timeSeries': state.get('timeSeries'),
            'deepReport': deep_report,
        })

        return {
            'finalAnswer': final_answer,
            'visualization': visualization,
            'deepReport': deep_report,
        }

    return _node


def _build_web_context(web_research: Dict[str, Any]) -> str:
    """Format web research results for the LLM."""
    parts = []

    answers = web_research.get('answers', [])
    for answer in answers[:3]:
        if answer.get('answer'):
            parts.append(f"Web research ({answer.get('query', '')}): {answer['answer'][:400]}")

    results = web_research.get('results', [])
    if results:
        headlines = []
        for r in results[:8]:
            headlines.append(f"  - {r.get('title', '')}")
        if headlines:
            parts.append("Web sources found:\n" + "\n".join(headlines))

    if not parts:
        return ''
    return "## Web Research Findings\n\n" + "\n\n".join(parts)


def _parse_report(content: str) -> Dict[str, Any]:
    """Parse LLM response into report structure."""
    try:
        return json.loads(content)
    except (json.JSONDecodeError, ValueError):
        pass

    # Try to extract JSON from response
    match = re.search(r'\{.*\}', content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except (json.JSONDecodeError, ValueError):
            pass

    # Fallback: use content as-is
    return {
        'summary': content[:200],
        'sections': [{
            'id': 'analysis',
            'title': 'Analysis',
            'content': content,
        }],
        'conversationalAnswer': content[:300],
    }


def _fallback_report(state: AgentState, error: str) -> Dict[str, Any]:
    """Generate a minimal report when LLM fails."""
    decision = state.get('decision') or {}
    return {
        'summary': f"Analysis completed with {decision.get('action', 'wait')} recommendation "
                   f"(confidence: {decision.get('confidence', 0):.0%}).",
        'sections': [{
            'id': 'error',
            'title': 'Analysis',
            'content': f'Report generation encountered an issue. The heuristic analysis suggests '
                       f'**{decision.get("action", "wait").upper()}** with {decision.get("confidence", 0):.0%} confidence.',
        }],
        'conversationalAnswer': f"I completed the analysis but had trouble generating the full report. "
                                f"Based on the data, the recommendation is to "
                                f"**{decision.get('action', 'wait')}** with "
                                f"{decision.get('confidence', 0):.0%} confidence.",
    }


def _build_sources(state: AgentState, web_research: Dict[str, Any]) -> list:
    """Build a list of data sources used in the analysis."""
    sources = []

    # API data sources
    data_quality = state.get('dataQuality') or {}
    if data_quality.get('market') in ('ok', 'partial'):
        ts = state.get('timeSeries') or {}
        values = ts.get('values', []) if isinstance(ts, dict) else []
        sources.append({'type': 'api', 'name': 'Market Prices', 'dataPoints': len(values)})

    if data_quality.get('fundamentals') in ('ok', 'partial'):
        fund_count = len(state.get('fundamentals') or {})
        sources.append({'type': 'api', 'name': 'Fundamentals', 'dataPoints': fund_count})

    if data_quality.get('news') in ('ok', 'partial'):
        news = state.get('news') or {}
        article_count = sum(len((v.get('data') or []) if isinstance(v, dict) else []) for v in news.values())
        sources.append({'type': 'api', 'name': 'News', 'dataPoints': article_count})

    # Web research sources
    queries = web_research.get('queries', [])
    total_results = web_research.get('totalResults', 0)
    if queries:
        sources.append({
            'type': 'web',
            'name': 'Web Research',
            'dataPoints': total_results,
            'queries': queries,
        })

    return sources
