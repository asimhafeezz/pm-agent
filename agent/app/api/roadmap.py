from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter()


class GenerateRoadmapRequest(BaseModel):
    projectId: str
    createLinearTickets: bool = False
    linearTeamId: Optional[str] = None
    linearProjectId: Optional[str] = None
    assigneeId: Optional[str] = None


class GenerateRoadmapResponse(BaseModel):
    roadmap: List[Dict[str, Any]]
    tickets: List[Dict[str, Any]]
    createdTickets: List[Dict[str, Any]] = Field(default_factory=list)


def _extract_json_object(text: str) -> Dict[str, Any]:
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1 or end <= start:
        return {}
    try:
        payload = json.loads(text[start : end + 1])
        return payload if isinstance(payload, dict) else {}
    except json.JSONDecodeError:
        return {}


@router.post('/agent/generate-roadmap', response_model=GenerateRoadmapResponse)
async def generate_roadmap(payload: GenerateRoadmapRequest, request: Request) -> GenerateRoadmapResponse:
    services = request.app.state.graph_services
    auth_token = request.headers.get('authorization', '')

    if not auth_token:
        raise HTTPException(status_code=401, detail='Authorization header is required')

    entities = await services.app_api_client.get(
        f"/projects/{payload.projectId}/knowledge/entities",
        auth_token,
    )
    docs = await services.app_api_client.get(
        f"/projects/{payload.projectId}/documents",
        auth_token,
    )

    entity_list = entities if isinstance(entities, list) else []
    doc_list = docs if isinstance(docs, list) else []

    prompt = f"""
You are an expert product manager.
Generate a practical roadmap and ticket plan from this project context.

Rules:
- Produce exactly 3 roadmap items for the next 6-8 weeks.
- For each roadmap item include: title, objective, priority (high|medium|low), riceScore (0-100), and milestones (array).
- Produce 8-15 actionable ticket drafts.
- Each ticket needs: title, description, priority (0-4 where 1 is urgent, 2 high, 3 normal, 4 low), labels (array), acceptanceCriteria (array).
- Keep ticket titles concise and implementation-ready.
- Return STRICT JSON only with this shape:
{{
  "roadmap": [ ... ],
  "tickets": [ ... ]
}}

Context summary:
- Documents uploaded: {len(doc_list)}
- Extracted entities: {len(entity_list)}
- Entities:
{json.dumps(entity_list[:60], ensure_ascii=True)}
"""

    llm_response = await services.llm_client.chat(
        system='You are a PM planning assistant. Return only valid JSON.',
        user=prompt,
        temperature=0.2,
    )
    content = llm_response.get('content', '') if isinstance(llm_response, dict) else str(llm_response)
    parsed = _extract_json_object(content)

    roadmap = parsed.get('roadmap', [])
    tickets = parsed.get('tickets', [])
    if not isinstance(roadmap, list):
        roadmap = []
    if not isinstance(tickets, list):
        tickets = []

    created_tickets: List[Dict[str, Any]] = []
    if payload.createLinearTickets:
        if not payload.linearTeamId:
            raise HTTPException(status_code=400, detail='linearTeamId is required when createLinearTickets=true')

        for ticket in tickets[:20]:
            if not isinstance(ticket, dict):
                continue
            body = {
                'input': {
                    'teamId': payload.linearTeamId,
                    'projectId': payload.linearProjectId,
                    'assigneeId': payload.assigneeId,
                    'title': str(ticket.get('title', 'Untitled Ticket')),
                    'description': str(ticket.get('description', '')),
                    'priority': int(ticket.get('priority', 3)),
                    'labelIds': ticket.get('labelIds'),
                }
            }

            try:
                created = await services.app_api_client.post(
                    '/integrations/linear/issues',
                    body,
                    auth_token,
                )
                if isinstance(created, dict):
                    created_tickets.append(created)
            except httpx.HTTPStatusError as exc:
                error_detail = exc.response.text.strip() or 'Failed to create Linear ticket'
                raise HTTPException(status_code=exc.response.status_code, detail=error_detail)

    return GenerateRoadmapResponse(
        roadmap=roadmap,
        tickets=tickets,
        createdTickets=created_tickets,
    )
