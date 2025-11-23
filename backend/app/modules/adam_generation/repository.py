"""
Repository layer for ADAM generation runs
Persists run metadata and results
"""

import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime
import hashlib

from .schemas import RunStatus, AdamGenerationRequest

logger = logging.getLogger(__name__)


class AdamRunRepository:
    """Repository for ADAM generation run records"""

    def __init__(self, base_path: Optional[Path] = None):
        """Initialize repository with base path for run storage"""
        if base_path is None:
            # Default to Content/Generated/ADAM
            self.base_path = Path("Content/Generated/ADAM")
        else:
            self.base_path = base_path
        self.base_path.mkdir(parents=True, exist_ok=True)

    async def create_run(
        self,
        run_id: str,
        study_id: str,
        adam_dataset: str,
        request_params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create a new run record"""
        run_dir = self.base_path / study_id / "runs" / run_id
        run_dir.mkdir(parents=True, exist_ok=True)

        metadata = {
            "run_id": run_id,
            "study_id": study_id,
            "adam_dataset": adam_dataset,
            "status": RunStatus.QUEUED.value,
            "request_params": request_params,
            "started_at": datetime.utcnow().isoformat(),
            "created_at": datetime.utcnow().isoformat(),
        }

        metadata_file = run_dir / "metadata.json"
        metadata_file.write_text(json.dumps(metadata, indent=2))

        logger.info(f"Created run record: {run_id} for study {study_id}")
        return metadata

    async def get_run(self, run_id: str, study_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get run record by ID"""
        if study_id:
            run_dir = self.base_path / study_id / "runs" / run_id
        else:
            # Search all studies (less efficient but flexible)
            for study_dir in self.base_path.iterdir():
                if study_dir.is_dir():
                    run_dir = study_dir / "runs" / run_id
                    if run_dir.exists():
                        break
            else:
                return None

        metadata_file = run_dir / "metadata.json"
        if not metadata_file.exists():
            return None

        try:
            metadata = json.loads(metadata_file.read_text())
            return metadata
        except Exception as e:
            logger.error(f"Error reading run metadata: {e}")
            return None

    async def update_run(
        self,
        run_id: str,
        study_id: str,
        status: Optional[RunStatus] = None,
        output_artifacts: Optional[Dict[str, str]] = None,
        execution_result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        progress_percent: Optional[int] = None,
        current_step: Optional[str] = None
    ):
        """Update run record"""
        run_dir = self.base_path / study_id / "runs" / run_id
        metadata_file = run_dir / "metadata.json"

        if not metadata_file.exists():
            logger.warning(f"Run {run_id} not found, cannot update")
            return

        metadata = json.loads(metadata_file.read_text())

        if status:
            metadata["status"] = status.value
            if status in [RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.CANCELED, RunStatus.TIMEOUT]:
                metadata["finished_at"] = datetime.utcnow().isoformat()

        if output_artifacts:
            metadata["output_artifacts"] = output_artifacts

        if execution_result:
            metadata["execution_result"] = execution_result
            if "duration" in execution_result:
                metadata["duration_seconds"] = execution_result["duration"]

        if error:
            metadata["error_message"] = error

        if progress_percent is not None:
            metadata["progress_percent"] = progress_percent

        if current_step:
            metadata["current_step"] = current_step

        metadata["updated_at"] = datetime.utcnow().isoformat()
        metadata_file.write_text(json.dumps(metadata, indent=2))

    async def save_feedback(
        self,
        run_id: str,
        study_id: str,
        feedback: Dict[str, Any]
    ):
        """Save user feedback for a run"""
        run_dir = self.base_path / study_id / "runs" / run_id
        feedback_file = run_dir / "feedback.json"

        feedback_data = {
            **feedback,
            "submitted_at": datetime.utcnow().isoformat()
        }

        feedback_file.write_text(json.dumps(feedback_data, indent=2))
        logger.info(f"Saved feedback for run {run_id}")

