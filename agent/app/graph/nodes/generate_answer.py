from __future__ import annotations

from typing import Any, Dict

from app.graph.services import GraphServices
from app.graph.state import AgentState
from app.graph.nodes.common import emit_event

SYSTEM_PROMPT = """You are AgentPM, an autonomous AI Product Manager assistant. You help product managers with:
- Understanding product documentation and requirements
- Generating and prioritizing roadmaps
- Creating and managing tickets (epics, stories, tasks)
- Analyzing product knowledge graphs
- Answering questions about the product
- Monitoring project activity across all connected tools (Linear, Gmail, Notion)
- Summarizing what happened recently in the project
- Identifying blockers, risks, and action items
- Processing meeting transcripts and extracting action items, decisions, and blockers
- Answering questions about what was discussed in meetings
- Detecting and reporting project risks (blocker aging, velocity decline, scope creep, dependency risks)
- Generating weekly project summaries and stakeholder updates (executive, engineering, stakeholder audiences)
- RICE/WSJF prioritization of backlog items using data from all connected sources

Be concise, actionable, and structured in your responses. When discussing priorities, use frameworks like RICE or WSJF. When breaking down work, think in terms of themes > epics > stories > tasks.

When activity context is provided, use it to give informed, up-to-date answers about what's happening in the project.

When meeting context is provided, use it to answer questions about meetings, action items, decisions, and blockers that were discussed. Cross-reference meeting insights with ticket activity where possible.

When risk context is provided, highlight open risks by severity. For critical/high risks, proactively suggest mitigation steps. When discussing sprint health, reference both risks and recent activity trends.

When summary context is provided, use it to give comprehensive status overviews including metrics, highlights, and recommendations.

If the user asks about something not related to product management, politely redirect them."""


def generate_answer_node(services: GraphServices):
    async def _node(state: AgentState) -> Dict[str, Any]:
        question = state.get('question', '')
        history = state.get('conversationHistory', [])
        retrieved_docs = state.get('retrievedDocuments', [])
        memories = state.get('relevantMemories', [])
        activity_context = state.get('activityContext', [])
        meeting_context = state.get('meetingContext', [])
        risk_context = state.get('riskContext', [])
        summary_context = state.get('summaryContext', {})

        # Build context sections
        context_parts = []

        if memories:
            memory_text = '\n'.join(
                f"- {m.get('memory', '')}" for m in memories if isinstance(m, dict)
            )
            context_parts.append(f"Relevant past context:\n{memory_text}")

        if retrieved_docs:
            doc_text = '\n---\n'.join(
                d.get('content', '') for d in retrieved_docs if isinstance(d, dict)
            )
            context_parts.append(f"Relevant product documents:\n{doc_text}")

        if activity_context:
            activity_lines = []
            for evt in activity_context[:15]:
                if isinstance(evt, dict):
                    source = evt.get('source', '')
                    summary = evt.get('summary', evt.get('title', ''))
                    occurred = evt.get('occurredAt', evt.get('createdAt', ''))
                    activity_lines.append(f"- [{source}] {summary} ({occurred})")
            if activity_lines:
                context_parts.append(f"Recent project activity:\n" + '\n'.join(activity_lines))

        if meeting_context:
            meeting_lines = []
            for mtg in meeting_context:
                if isinstance(mtg, dict):
                    mtg_title = mtg.get('title', 'Untitled')
                    mtg_date = mtg.get('meetingDate', '')
                    meeting_lines.append(f"\n### {mtg_title} ({mtg_date})")
                    for insight in mtg.get('insights', []):
                        if isinstance(insight, dict):
                            itype = insight.get('insightType', '').replace('_', ' ')
                            content = insight.get('content', '')
                            assignee = insight.get('assignee', '')
                            assignee_str = f" [{assignee}]" if assignee else ''
                            meeting_lines.append(f"- **{itype}**{assignee_str}: {content}")
            if meeting_lines:
                context_parts.append("Meeting insights:" + '\n'.join(meeting_lines))

        if risk_context:
            risk_lines = []
            for risk in risk_context:
                if isinstance(risk, dict):
                    severity = risk.get('severity', 'unknown').upper()
                    risk_type = risk.get('riskType', '').replace('_', ' ')
                    desc = risk.get('description', '')
                    mitigation = risk.get('mitigation', '')
                    status = risk.get('status', 'open')
                    line = f"- [{severity}] {risk_type}: {desc}"
                    if mitigation:
                        line += f" | Mitigation: {mitigation}"
                    line += f" (status: {status})"
                    risk_lines.append(line)
            if risk_lines:
                context_parts.append(f"Open project risks:\n" + '\n'.join(risk_lines))

        if summary_context and isinstance(summary_context, dict):
            summary_lines = []
            exec_summary = summary_context.get('executiveSummary', '')
            if exec_summary:
                summary_lines.append(f"Executive Summary: {exec_summary}")
            metrics = summary_context.get('metrics', {})
            if metrics:
                summary_lines.append(f"Metrics: {metrics}")
            highlights = summary_context.get('highlights', [])
            if highlights:
                hl_text = ', '.join(
                    h.get('title', str(h)) if isinstance(h, dict) else str(h)
                    for h in highlights
                )
                summary_lines.append(f"Highlights: {hl_text}")
            recommendations = summary_context.get('recommendations', [])
            if recommendations:
                rec_text = ', '.join(
                    r.get('action', str(r)) if isinstance(r, dict) else str(r)
                    for r in recommendations
                )
                summary_lines.append(f"Recommendations: {rec_text}")
            if summary_lines:
                period_start = summary_context.get('periodStart', '')
                period_end = summary_context.get('periodEnd', '')
                header = "Latest weekly summary"
                if period_start and period_end:
                    header += f" ({period_start[:10]} to {period_end[:10]})"
                context_parts.append(f"{header}:\n" + '\n'.join(summary_lines))

        # Construct user message with history
        user_message = ""
        if context_parts:
            user_message += '\n\n'.join(context_parts) + '\n\n'

        for msg in history[-5:]:
            if isinstance(msg, dict):
                role = msg.get("role", "user")
                content = msg.get("content", "")
                user_message += f"{role}: {content}\n"

        user_message += f"user: {question}"

        response = await services.llm_client.chat(
            system=SYSTEM_PROMPT,
            user=user_message,
            temperature=0.7,
        )

        answer = response.get('content', 'I am sorry, I cannot answer that right now.')

        await emit_event(services, state, 'text_token', {'token': answer, 'done': True})

        return {
            'finalAnswer': answer,
        }

    return _node
