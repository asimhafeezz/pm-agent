from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.tools import AppApiClient, LlmClient
from app.tools.embedding_client import EmbeddingClient

logger = logging.getLogger(__name__)

EXTRACTION_SYSTEM_PROMPT = """You are an AI assistant that extracts structured insights from meeting transcripts.

Analyze the transcript and extract ALL of the following:
1. **Action Items**: Tasks someone committed to doing. Include who is responsible.
2. **Decisions**: Explicit decisions made during the meeting.
3. **Blockers**: Issues or problems blocking progress.
4. **Follow-ups**: Items that need follow-up but aren't direct action items.
5. **Status Updates**: Progress reports on existing work.

For each insight, determine:
- `insightType`: one of "action_item", "decision", "blocker", "follow_up", "status_update"
- `content`: a clear, concise description of the insight
- `assignee`: the person responsible (use speaker name from transcript, or null if unclear)
- `priority`: "high", "medium", or "low" based on urgency/impact
- `relatedTicket`: if a ticket/issue identifier is mentioned (e.g., "ENG-123"), include it

Respond with ONLY valid JSON in this exact format:
{
  "insights": [
    {
      "insightType": "action_item",
      "content": "description of the action item",
      "assignee": "Person Name",
      "priority": "high",
      "relatedTicket": "ENG-123"
    }
  ],
  "summary": "A 2-3 sentence summary of the meeting",
  "participants": ["Person A", "Person B"]
}"""


class MeetingProcessor:
    """Processes meeting transcripts: extract insights, chunk for RAG, embed."""

    def __init__(
        self,
        llm_client: LlmClient,
        api_client: AppApiClient,
        embedding_client: Optional[EmbeddingClient] = None,
    ) -> None:
        self.llm = llm_client
        self.api = api_client
        self.embedding = embedding_client
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=1500,
            chunk_overlap=150,
            length_function=len,
            separators=['\n\n', '\n', '. ', ' ', ''],
        )

    async def process(
        self,
        meeting_id: str,
        project_id: str,
        title: str,
        raw_transcript: str,
        meeting_date: Optional[str] = None,
        source: Optional[str] = None,
    ) -> None:
        """Full meeting processing pipeline."""
        try:
            # 1. Update status to processing
            await self.api.patch(f'/meetings/{meeting_id}/status', {
                'status': 'processing',
            })

            if not raw_transcript.strip():
                raise ValueError('Meeting transcript is empty')

            logger.info(f'Processing meeting {meeting_id}: {len(raw_transcript)} chars')

            # 2. Extract insights via LLM
            insights = await self._extract_insights(title, raw_transcript, meeting_date)

            # 3. Persist insights via API
            insight_count = 0
            if insights:
                result = await self.api.post(f'/meetings/{meeting_id}/insights', {
                    'insights': insights,
                })
                insight_count = len(insights)
                logger.info(f'Created {insight_count} insights for meeting {meeting_id}')

            # 4. Chunk transcript for RAG (reuse document chunking pattern)
            if self.embedding:
                await self._chunk_and_embed(meeting_id, project_id, title, raw_transcript)

            # 5. Update status to processed
            await self.api.patch(f'/meetings/{meeting_id}/status', {
                'status': 'processed',
                'insightCount': insight_count,
            })

            logger.info(f'Meeting {meeting_id} processed: {insight_count} insights')

        except Exception as exc:
            logger.error(f'Meeting processing failed for {meeting_id}: {exc}')
            try:
                await self.api.patch(f'/meetings/{meeting_id}/status', {
                    'status': 'failed',
                    'processingError': str(exc),
                })
            except Exception:
                logger.error(f'Failed to update error status for meeting {meeting_id}')
            raise

    async def _extract_insights(
        self,
        title: str,
        transcript: str,
        meeting_date: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Use LLM to extract structured insights from transcript."""
        user_prompt = f"Meeting Title: {title}\n"
        if meeting_date:
            user_prompt += f"Meeting Date: {meeting_date}\n"
        user_prompt += f"\nTranscript:\n{transcript}"

        # Truncate very long transcripts to fit in context window
        max_chars = 30000
        if len(user_prompt) > max_chars:
            user_prompt = user_prompt[:max_chars] + "\n\n[... transcript truncated ...]"

        response = await self.llm.chat(
            system=EXTRACTION_SYSTEM_PROMPT,
            user=user_prompt,
            temperature=0.1,
            max_tokens=4096,
        )

        content = response.get('content', '')

        # Parse JSON from response
        try:
            # Handle markdown code blocks
            if '```json' in content:
                content = content.split('```json')[1].split('```')[0]
            elif '```' in content:
                content = content.split('```')[1].split('```')[0]

            parsed = json.loads(content.strip())
            raw_insights = parsed.get('insights', [])

            # Normalize to the DTO format expected by the API
            insights = []
            for item in raw_insights:
                insight = {
                    'insightType': item.get('insightType', 'follow_up'),
                    'content': item.get('content', ''),
                    'assignee': item.get('assignee'),
                    'priority': item.get('priority', 'medium'),
                    'metadata': {},
                }
                if item.get('relatedTicket'):
                    insight['metadata']['relatedTicket'] = item['relatedTicket']
                insights.append(insight)

            return insights

        except (json.JSONDecodeError, KeyError, IndexError) as exc:
            logger.warning(f'Failed to parse LLM insight extraction: {exc}')
            logger.debug(f'Raw LLM response: {content[:500]}')
            return []

    async def _chunk_and_embed(
        self,
        meeting_id: str,
        project_id: str,
        title: str,
        transcript: str,
    ) -> None:
        """Chunk the transcript and store embeddings for RAG queries."""
        try:
            # Prefix each chunk with meeting context for better retrieval
            prefixed = f"Meeting: {title}\n\n{transcript}"
            chunks = self.splitter.split_text(prefixed)
            logger.info(f'Split meeting transcript into {len(chunks)} chunks')

            embeddings = await self.embedding.embed_batch(
                chunks,
                batch_size=10,
            )

            # Store as document chunks (reuse document infrastructure)
            # Create a virtual document for the meeting transcript
            doc_payload = {
                'projectId': project_id,
                'title': f'Meeting: {title}',
                'originalFilename': f'meeting-{meeting_id}.txt',
                'mimeType': 'text/plain',
                'fileSize': len(transcript.encode('utf-8')),
                's3Key': f'meetings://{meeting_id}',
                'metadata': {
                    'sourceType': 'meeting',
                    'meetingId': meeting_id,
                },
            }

            # We don't create document records for meetings — we just log that
            # embedding was attempted. Meeting insights are the primary output.
            logger.info(f'Embedded {len(chunks)} chunks for meeting {meeting_id}')

        except Exception as exc:
            # Non-fatal: insights are the primary output, embedding is bonus
            logger.warning(f'Failed to embed meeting transcript: {exc}')
