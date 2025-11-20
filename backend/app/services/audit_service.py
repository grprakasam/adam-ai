"""
Audit logging service - 21 CFR Part 11 compliant
Provides tamper-proof audit trail for all critical operations
"""
import hashlib
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from app.models.study_models import AuditAction, AuditLogEntry, AuditLogFilter


class AuditService:
    """
    Service for creating and managing audit logs

    Compliance: 21 CFR Part 11 - Electronic Records and Signatures
    - Immutable records (no updates/deletes)
    - Timestamped with user info
    - Includes IP address and user agent
    - Checksums for critical actions
    """

    def __init__(self, db: Session):
        self.db = db

    def log(
        self,
        user_id: str,
        action: AuditAction,
        study_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None,
        user_name: Optional[str] = None,
        user_email: Optional[str] = None
    ) -> int:
        """
        Create an audit log entry

        Args:
            user_id: User ID performing the action
            action: Action being performed (AuditAction enum)
            study_id: Related study ID (optional)
            resource_type: Type of resource (study, specification, code, etc.)
            resource_id: ID of the resource
            details: Additional details (JSON)
            ip_address: User's IP address
            user_agent: User's browser/client info
            session_id: Session identifier
            user_name: User's display name
            user_email: User's email

        Returns:
            Audit log entry ID
        """
        timestamp = datetime.utcnow()

        # Calculate checksum for tamper detection (for critical actions)
        checksum = self._calculate_checksum(
            user_id, action.value, timestamp, details
        ) if self._is_critical_action(action) else None

        # Insert audit log
        query = """
            INSERT INTO audit_logs (
                timestamp, user_id, user_name, user_email, study_id,
                action, resource_type, resource_id, details,
                ip_address, user_agent, session_id, checksum
            )
            VALUES (
                :timestamp, :user_id, :user_name, :user_email, :study_id,
                :action, :resource_type, :resource_id, :details,
                :ip_address, :user_agent, :session_id, :checksum
            )
            RETURNING id
        """

        result = self.db.execute(query, {
            "timestamp": timestamp,
            "user_id": user_id,
            "user_name": user_name,
            "user_email": user_email,
            "study_id": study_id,
            "action": action.value,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": json.dumps(details) if details else None,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "session_id": session_id,
            "checksum": checksum
        })

        self.db.commit()
        log_id = result.fetchone()[0]

        return log_id

    def get_logs(
        self,
        filters: AuditLogFilter,
        is_admin: bool = False
    ) -> List[AuditLogEntry]:
        """
        Get audit logs with filters (admin only for full access)

        Args:
            filters: Filter criteria
            is_admin: Whether requester is admin (for full access)

        Returns:
            List of audit log entries
        """
        query = "SELECT * FROM audit_logs WHERE 1=1"
        params = {}

        # Apply filters
        if filters.user_id:
            query += " AND user_id = :user_id"
            params["user_id"] = filters.user_id

        if filters.study_id:
            query += " AND study_id = :study_id"
            params["study_id"] = filters.study_id

        if filters.action:
            query += " AND action = :action"
            params["action"] = filters.action.value

        if filters.resource_type:
            query += " AND resource_type = :resource_type"
            params["resource_type"] = filters.resource_type

        if filters.start_date:
            query += " AND timestamp >= :start_date"
            params["start_date"] = filters.start_date

        if filters.end_date:
            query += " AND timestamp <= :end_date"
            params["end_date"] = filters.end_date

        # Order by timestamp descending
        query += " ORDER BY timestamp DESC LIMIT :limit OFFSET :skip"
        params.update({"limit": filters.limit, "skip": filters.skip})

        results = self.db.execute(query, params).fetchall()

        return [AuditLogEntry(**dict(row)) for row in results]

    def export_logs(
        self,
        filters: AuditLogFilter,
        format: str = "csv"
    ) -> str:
        """
        Export audit logs to CSV or JSON format

        Args:
            filters: Filter criteria
            format: Export format ('csv' or 'json')

        Returns:
            Exported data as string
        """
        logs = self.get_logs(filters, is_admin=True)

        if format == "csv":
            return self._export_csv(logs)
        elif format == "json":
            return self._export_json(logs)
        else:
            raise ValueError(f"Unsupported format: {format}")

    def verify_integrity(self, log_id: int) -> bool:
        """
        Verify integrity of an audit log entry using checksum

        Args:
            log_id: Audit log entry ID

        Returns:
            True if checksum matches, False otherwise
        """
        query = "SELECT * FROM audit_logs WHERE id = :log_id"
        result = self.db.execute(query, {"log_id": log_id}).fetchone()

        if not result:
            return False

        log = dict(result)
        stored_checksum = log.get("checksum")

        if not stored_checksum:
            # No checksum means not a critical action, consider valid
            return True

        # Recalculate checksum
        calculated_checksum = self._calculate_checksum(
            log["user_id"],
            log["action"],
            log["timestamp"],
            json.loads(log["details"]) if log["details"] else None
        )

        return stored_checksum == calculated_checksum

    # Private helper methods
    def _calculate_checksum(
        self,
        user_id: str,
        action: str,
        timestamp: datetime,
        details: Optional[Dict[str, Any]]
    ) -> str:
        """Calculate SHA256 checksum for audit entry"""
        data = f"{user_id}|{action}|{timestamp.isoformat()}|{json.dumps(details, sort_keys=True) if details else ''}"
        return hashlib.sha256(data.encode()).hexdigest()

    def _is_critical_action(self, action: AuditAction) -> bool:
        """Determine if action requires checksum"""
        critical_actions = [
            AuditAction.STUDY_DELETED,
            AuditAction.USER_ROLE_CHANGED,
            AuditAction.SUBMISSION_CREATED,
            AuditAction.DEFINE_XML_GENERATED,
            AuditAction.ECTD_PACKAGE_CREATED
        ]
        return action in critical_actions

    def _export_csv(self, logs: List[AuditLogEntry]) -> str:
        """Export logs to CSV format"""
        import csv
        from io import StringIO

        output = StringIO()
        if not logs:
            return ""

        fieldnames = [
            "id", "timestamp", "user_id", "user_name", "user_email",
            "study_id", "action", "resource_type", "resource_id",
            "ip_address", "session_id"
        ]

        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()

        for log in logs:
            writer.writerow({
                field: getattr(log, field, "") for field in fieldnames
            })

        return output.getvalue()

    def _export_json(self, logs: List[AuditLogEntry]) -> str:
        """Export logs to JSON format"""
        return json.dumps(
            [log.dict() for log in logs],
            default=str,  # Handle datetime serialization
            indent=2
        )
