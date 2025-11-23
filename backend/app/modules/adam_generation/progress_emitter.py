"""
Progress Emitter for ADAM Generation

Provides Server-Sent Events (SSE) for real-time progress tracking.
"""

import asyncio
import json
import logging
from typing import Dict, Optional, Callable
from datetime import datetime
from collections import defaultdict

logger = logging.getLogger(__name__)


class ProgressEmitter:
    """Emit progress events for ADAM generation runs"""

    def __init__(self):
        self._subscribers: Dict[str, list] = defaultdict(list)
        self._progress_cache: Dict[str, dict] = {}

    def emit(
        self,
        run_id: str,
        step: str,
        percent: int,
        message: Optional[str] = None,
        metadata: Optional[dict] = None
    ):
        """Emit a progress event"""
        event = {
            "run_id": run_id,
            "step": step,
            "progress_percent": percent,
            "current_step": message or step,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {}
        }

        # Cache the latest progress
        self._progress_cache[run_id] = event

        # Notify all subscribers
        subscribers = self._subscribers.get(run_id, [])
        for queue in subscribers:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning(f"Queue full for run {run_id}, dropping event")
            except Exception as e:
                logger.error(f"Error emitting progress for {run_id}: {e}")

    async def subscribe(self, run_id: str):
        """Subscribe to progress events for a run"""
        queue = asyncio.Queue(maxsize=100)
        self._subscribers[run_id].append(queue)

        try:
            # Send cached progress if available
            if run_id in self._progress_cache:
                yield self._progress_cache[run_id]

            # Stream new events
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield event
                except asyncio.TimeoutError:
                    # Send heartbeat to keep connection alive
                    yield {
                        "run_id": run_id,
                        "step": "heartbeat",
                        "progress_percent": self._progress_cache.get(run_id, {}).get("progress_percent", 0),
                        "current_step": "Waiting...",
                        "timestamp": datetime.utcnow().isoformat(),
                    }
        finally:
            # Cleanup
            if run_id in self._subscribers:
                self._subscribers[run_id].remove(queue)
                if not self._subscribers[run_id]:
                    del self._subscribers[run_id]

    def complete(self, run_id: str, final_status: str, result: Optional[dict] = None):
        """Mark run as complete and send final event"""
        event = {
            "run_id": run_id,
            "step": "complete",
            "progress_percent": 100,
            "current_step": f"Completed: {final_status}",
            "status": final_status,
            "timestamp": datetime.utcnow().isoformat(),
            "result": result or {}
        }

        self._progress_cache[run_id] = event

        # Notify all subscribers
        subscribers = self._subscribers.get(run_id, [])
        for queue in subscribers:
            try:
                queue.put_nowait(event)
            except Exception as e:
                logger.error(f"Error sending completion for {run_id}: {e}")

        # Cleanup after a delay
        asyncio.create_task(self._cleanup_after_delay(run_id))

    async def _cleanup_after_delay(self, run_id: str, delay: int = 60):
        """Cleanup subscribers after delay"""
        await asyncio.sleep(delay)
        if run_id in self._subscribers:
            del self._subscribers[run_id]
        if run_id in self._progress_cache:
            del self._progress_cache[run_id]


# Global instance
_progress_emitter: Optional[ProgressEmitter] = None


def get_progress_emitter() -> ProgressEmitter:
    """Get or create global progress emitter instance"""
    global _progress_emitter
    if _progress_emitter is None:
        _progress_emitter = ProgressEmitter()
    return _progress_emitter

