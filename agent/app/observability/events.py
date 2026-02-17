from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict

from app.schemas import StreamEvent


class RunEventBus:
    def __init__(self) -> None:
        self._queues: dict[str, asyncio.Queue[StreamEvent]] = {}

    def get_queue(self, run_id: str) -> asyncio.Queue[StreamEvent]:
        if run_id not in self._queues:
            self._queues[run_id] = asyncio.Queue()
        return self._queues[run_id]

    async def emit(self, run_id: str, event: str, payload: Dict[str, Any] | None = None) -> None:
        queue = self.get_queue(run_id)
        message = StreamEvent(
            run_id=run_id,
            event=event,
            timestamp=datetime.now(timezone.utc),
            payload=payload,
        )
        await queue.put(message)

    def close(self, run_id: str) -> None:
        self._queues.pop(run_id, None)
