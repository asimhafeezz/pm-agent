from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.pipelines.risk_detector import RiskDetector
from app.pipelines.stakeholder_reporter import StakeholderReporter

router = APIRouter()


# ---------- Request models ----------

class DetectRisksRequest(BaseModel):
    projectId: str
    userId: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class GenerateSummaryRequest(BaseModel):
    projectId: str
    userId: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class StakeholderUpdateRequest(BaseModel):
    projectId: str
    audience: str = 'stakeholder'  # executive | engineering | stakeholder


class PrioritizeRequest(BaseModel):
    projectId: str
    items: Optional[List[Dict[str, Any]]] = None


# ---------- Helpers ----------

def _build_risk_detector(request: Request) -> RiskDetector:
    services = request.app.state.graph_services
    return RiskDetector(
        llm_client=services.llm_client,
        api_client=services.app_api_client,
        integration_client=getattr(services, 'integration_client', None),
    )


def _build_reporter(request: Request) -> StakeholderReporter:
    services = request.app.state.graph_services
    return StakeholderReporter(
        llm_client=services.llm_client,
        api_client=services.app_api_client,
        integration_client=getattr(services, 'integration_client', None),
    )


# ---------- Endpoints ----------

@router.post('/agent/detect-risks')
async def detect_risks(
    payload: DetectRisksRequest,
    request: Request,
) -> Dict[str, Any]:
    """Run risk detection pipeline."""
    detector = _build_risk_detector(request)
    return await detector.detect_risks(project_id=payload.projectId)


@router.post('/agent/generate-summary')
async def generate_summary(
    payload: GenerateSummaryRequest,
    request: Request,
) -> Dict[str, Any]:
    """Generate a weekly project summary."""
    reporter = _build_reporter(request)
    return await reporter.generate_weekly_summary(project_id=payload.projectId)


@router.post('/agent/generate-stakeholder-update')
async def generate_stakeholder_update(
    payload: StakeholderUpdateRequest,
    request: Request,
) -> Dict[str, Any]:
    """Generate a stakeholder update tailored by audience."""
    reporter = _build_reporter(request)
    return await reporter.generate_stakeholder_update(
        project_id=payload.projectId,
        audience=payload.audience,
    )


@router.post('/agent/prioritize')
async def prioritize(
    payload: PrioritizeRequest,
    request: Request,
) -> Dict[str, Any]:
    """RICE/WSJF prioritization of issues."""
    reporter = _build_reporter(request)
    return await reporter.prioritize(
        project_id=payload.projectId,
        items=payload.items,
    )
