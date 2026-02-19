from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Request
from pydantic import BaseModel

from app.pipelines.meeting_processor import MeetingProcessor

router = APIRouter()


class ProcessMeetingRequest(BaseModel):
    meetingId: str
    projectId: str
    title: str
    rawTranscript: str
    meetingDate: Optional[str] = None
    source: Optional[str] = None


class ProcessMeetingResponse(BaseModel):
    status: str
    meetingId: str


async def _run_processing(
    request: ProcessMeetingRequest,
    api_client,
    llm_client,
    embedding_client,
):
    processor = MeetingProcessor(
        llm_client=llm_client,
        api_client=api_client,
        embedding_client=embedding_client,
    )
    await processor.process(
        meeting_id=request.meetingId,
        project_id=request.projectId,
        title=request.title,
        raw_transcript=request.rawTranscript,
        meeting_date=request.meetingDate,
        source=request.source,
    )


@router.post('/agent/process-meeting', response_model=ProcessMeetingResponse)
async def process_meeting(
    payload: ProcessMeetingRequest,
    background_tasks: BackgroundTasks,
    request: Request,
) -> ProcessMeetingResponse:
    services = request.app.state.graph_services
    embedding_client = request.app.state.embedding_client

    background_tasks.add_task(
        _run_processing,
        payload,
        services.app_api_client,
        services.llm_client,
        embedding_client,
    )

    return ProcessMeetingResponse(
        status='processing',
        meetingId=payload.meetingId,
    )
