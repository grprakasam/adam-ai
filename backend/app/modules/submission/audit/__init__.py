"""Audit trail logger - FDA 21 CFR Part 11 aligned"""

from datetime import datetime
from pathlib import Path
import json
import uuid
from typing import Optional, Dict, Any, List
from loguru import logger


class AuditLogger:
    """
    FDA 21 CFR Part 11 aligned audit trail.
    Records all significant actions with timestamps, user, and context.
    """

    def __init__(self, base_path: Path = None):
        if base_path is None:
            base_path = Path("Content/Submissions")
        self.base_path = base_path
        self.session_id = str(uuid.uuid4())

    def log(
        self,
        action: str,
        study_id: str,
        dataset: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        user: str = "system"
    ):
        """
        Log an audit event.
        
        Args:
            action: Action identifier (e.g., 'preflight_start', 'validation_complete')
            study_id: Study identifier
            dataset: Optional dataset name
            details: Optional additional details
            user: User identifier (default: 'system')
        """
        event = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "action": action,
            "study_id": study_id,
            "dataset": dataset,
            "user": user,
            "details": details or {},
            "session_id": self.session_id
        }

        # Append to JSONL audit file
        audit_file = self.base_path / study_id / "audit" / "audit_trail.jsonl"
        audit_file.parent.mkdir(parents=True, exist_ok=True)

        with audit_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(event) + "\n")

        # Also log to Loguru for centralized logging
        logger.info(f"AUDIT: {action} | {study_id}/{dataset} | {user}")

    def get_audit_trail(self, study_id: str) -> List[Dict[str, Any]]:
        """
        Retrieve full audit trail for a study.
        
        Args:
            study_id: Study identifier
            
        Returns:
            List of audit events
        """
        audit_file = self.base_path / study_id / "audit" / "audit_trail.jsonl"

        if not audit_file.exists():
            return []

        events = []
        with audit_file.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    events.append(json.loads(line))
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON in audit trail: {line}")

        return events

    def get_recent_activity(
        self,
        study_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get recent audit trail entries.
        
        Args:
            study_id: Study identifier
            limit: Maximum number of entries to return
            
        Returns:
            List of recent audit events
        """
        all_events = self.get_audit_trail(study_id)
        # Return most recent first
        return list(reversed(all_events[-limit:]))
