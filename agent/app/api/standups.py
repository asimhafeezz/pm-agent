from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.pipelines.standup_processor import StandupProcessor

router = APIRouter()


# ---------- Request / Response models ----------

class StandupResponseItem(BaseModel):
    respondent: str
    rawText: str = ''
    yesterday: Optional[str] = None
    today: Optional[str] = None
    blockers: Optional[str] = None
    respondedAt: Optional[str] = None


class ProcessStandupRequest(BaseModel):
    projectId: str
    responses: List[StandupResponseItem]


class SprintDigestRequest(BaseModel):
    projectId: str
    userId: str
    config: Optional[Dict[str, Any]] = None


class TriggerStandupRequest(BaseModel):
    projectId: str
    userId: str
    config: Optional[Dict[str, Any]] = None


class CheckBlockersRequest(BaseModel):
    projectId: str
    userId: str
    config: Optional[Dict[str, Any]] = None


# ---------- Helpers ----------

def _build_processor(request: Request) -> StandupProcessor:
    services = request.app.state.graph_services
    return StandupProcessor(
        llm_client=services.llm_client,
        api_client=services.app_api_client,
        integration_client=getattr(services, 'integration_client', None),
    )


# ---------- Endpoints ----------

@router.post('/agent/process-standup')
async def process_standup(
    payload: ProcessStandupRequest,
    request: Request,
) -> Dict[str, Any]:
    """Process standup responses into a unified summary."""
    processor = _build_processor(request)
    responses = [r.model_dump() for r in payload.responses]
    result = await processor.process_standup(
        project_id=payload.projectId,
        responses=responses,
    )
    return result


@router.post('/agent/generate-sprint-digest')
async def generate_sprint_digest(
    payload: SprintDigestRequest,
    request: Request,
) -> Dict[str, Any]:
    """Generate a sprint health digest from all available data."""
    processor = _build_processor(request)
    result = await processor.generate_sprint_digest(
        project_id=payload.projectId,
        user_id=payload.userId,
        config=payload.config,
    )
    return result


@router.post('/agent/trigger-standup')
async def trigger_standup(
    payload: TriggerStandupRequest,
    request: Request,
) -> Dict[str, Any]:
    """Trigger standup prompts via Slack DMs."""
    processor = _build_processor(request)
    result = await processor.trigger_standup(
        project_id=payload.projectId,
        user_id=payload.userId,
        config=payload.config,
    )
    return result


@router.post('/agent/check-blockers')
async def check_blockers(
    payload: CheckBlockersRequest,
    request: Request,
) -> Dict[str, Any]:
    """Check for blockers, stale issues, and escalation needs."""
    processor = _build_processor(request)
    result = await processor.check_blockers(
        project_id=payload.projectId,
        user_id=payload.userId,
        config=payload.config,
    )
    return result
