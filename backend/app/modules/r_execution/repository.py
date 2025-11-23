"""
Repository for R execution runs

Stores run metadata and state in file-based storage.
"""

import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime

from .schemas import RunStatus

logger = logging.getLogger(__name__)


class RExecutionRepository:
    """File-based repository for R execution runs"""

    def __init__(self, base_path: Optional[Path] = None):
        self.base_path = base_path or Path("Content/Generated/R_Execution")
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _get_run_dir(self, run_id: str) -> Path:
        """Get directory for a run"""
        run_dir = self.base_path / "runs" / run_id
        return run_dir

    def _get_metadata_file(self, run_id: str) -> Path:
        """Get metadata file path for a run"""
        return self._get_run_dir(run_id) / "metadata.json"

    async def create_run(
        self,
        run_id: str,
        request_params: Dict[str, Any]
    ) -> None:
        """Create a new run record"""
        run_dir = self._get_run_dir(run_id)
        run_dir.mkdir(parents=True, exist_ok=True)

        metadata = {
            "run_id": run_id,
            "status": RunStatus.QUEUED.value,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "started_at": None,
            "finished_at": None,
            "progress_percent": 0,
            "current_step": "Queued",
            "request_params": request_params,
            "error_message": None
        }

        metadata_file = self._get_metadata_file(run_id)
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"Created run record: {run_id}")

    async def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Get run metadata"""
        metadata_file = self._get_metadata_file(run_id)

        if not metadata_file.exists():
            return None

        try:
            with open(metadata_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading run metadata {run_id}: {e}")
            return None

    async def update_run(
        self,
        run_id: str,
        status: Optional[RunStatus] = None,
        progress_percent: Optional[int] = None,
        current_step: Optional[str] = None,
        error_message: Optional[str] = None,
        **kwargs
    ) -> None:
        """Update run metadata"""
        metadata = await self.get_run(run_id)

        if not metadata:
            logger.warning(f"Run {run_id} not found for update")
            return

        # Update fields
        if status is not None:
            metadata["status"] = status.value

            # Set timestamps based on status
            if status == RunStatus.RUNNING and not metadata.get("started_at"):
                metadata["started_at"] = datetime.utcnow().isoformat() + "Z"
            elif status in [RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.TIMEOUT, RunStatus.CANCELED]:
                if not metadata.get("finished_at"):
                    metadata["finished_at"] = datetime.utcnow().isoformat() + "Z"

                # Calculate duration
                if metadata.get("started_at"):
                    started = datetime.fromisoformat(metadata["started_at"].replace('Z', '+00:00'))
                    finished = datetime.fromisoformat(metadata["finished_at"].replace('Z', '+00:00'))
                    metadata["duration_seconds"] = (finished - started).total_seconds()

        if progress_percent is not None:
            metadata["progress_percent"] = progress_percent

        if current_step is not None:
            metadata["current_step"] = current_step

        if error_message is not None:
            metadata["error_message"] = error_message

        # Add any additional kwargs
        metadata.update(kwargs)

        # Save
        metadata_file = self._get_metadata_file(run_id)
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)

        logger.debug(f"Updated run {run_id}: status={status}, progress={progress_percent}%")

    async def list_runs(self, limit: int = 50) -> list[Dict[str, Any]]:
        """List recent runs"""
        runs_dir = self.base_path / "runs"

        if not runs_dir.exists():
            return []

        runs = []
        for run_dir in sorted(runs_dir.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
            if run_dir.is_dir():
                metadata = await self.get_run(run_dir.name)
                if metadata:
                    runs.append(metadata)

                if len(runs) >= limit:
                    break

        return runs
