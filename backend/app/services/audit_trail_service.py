"""
Audit Trail Service
Implements 21 CFR Part 11.10(e) - Audit Trail Requirements

Requirements:
- Secure, computer-generated, time-stamped audit trails
- Document record creation, modification, or deletion
- Enforce generation of audit trail (automatic)
- Prevent modification or deletion of audit records
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
import uuid
from loguru import logger

from app.models.compliance import AuditEntry, AuditAction


class AuditTrailService:
    """
    Immutable audit trail service with blockchain-style hash chain

    Features:
    - Automatic audit logging for all critical operations
    - Blockchain-style hash chaining for tamper detection
    - Immutable records (cannot be modified or deleted)
    - Complete change history with before/after states
    """

    def __init__(self):
        self.audit_entries = []  # In-memory (will be replaced with database)
        self.last_hash = None

    async def log_action(
        self,
        user_id: str,
        username: str,
        action: AuditAction,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        regulatory_reason: Optional[str] = None,
        session_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditEntry:
        """
        Log an action to the audit trail

        This creates an immutable audit entry with a hash chain for tamper detection

        Args:
            user_id: User performing action
            username: Username (for readability)
            action: Action type (from AuditAction enum)
            resource_type: Type of resource affected (optional)
            resource_id: ID of resource affected (optional)
            before_state: State before change (for updates/deletes)
            after_state: State after change (for creates/updates)
            success: Whether action succeeded
            error_message: Error message if failed
            regulatory_reason: Reason for change (21 CFR Part 11)
            session_id: User session ID
            ip_address: IP address
            user_agent: Browser/client user agent
            metadata: Additional metadata

        Returns:
            AuditEntry: The created audit entry
        """
        # Generate change summary
        change_summary = self._generate_change_summary(action, resource_type, resource_id, before_state, after_state)

        # Create audit entry
        entry = AuditEntry(
            audit_id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            user_id=user_id,
            username=username,
            session_id=session_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            before_state=before_state,
            after_state=after_state,
            change_summary=change_summary,
            ip_address=ip_address,
            user_agent=user_agent,
            success=success,
            error_message=error_message,
            regulatory_reason=regulatory_reason,
            metadata=metadata,
            previous_hash=self.last_hash,
            current_hash=""  # Will be calculated
        )

        # Calculate hash with previous entry's hash (blockchain-style)
        entry.current_hash = entry.calculate_hash(self.last_hash)

        # Store entry (in-memory for now, will be database with trigger)
        self.audit_entries.append(entry)
        self.last_hash = entry.current_hash

        logger.info(
            f"Audit entry created: {entry.audit_id}, action={action}, "
            f"user={username}, resource={resource_type}/{resource_id}"
        )

        return entry

    async def get_audit_trail(
        self,
        user_id: Optional[str] = None,
        action: Optional[AuditAction] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[AuditEntry]:
        """
        Query audit trail with filters

        Args:
            user_id: Filter by user
            action: Filter by action type
            resource_type: Filter by resource type
            resource_id: Filter by specific resource
            start_date: Filter by start date
            end_date: Filter by end date
            limit: Max entries to return
            offset: Offset for pagination

        Returns:
            List of matching audit entries
        """
        results = self.audit_entries

        # Apply filters
        if user_id:
            results = [e for e in results if e.user_id == user_id]

        if action:
            results = [e for e in results if e.action == action]

        if resource_type:
            results = [e for e in results if e.resource_type == resource_type]

        if resource_id:
            results = [e for e in results if e.resource_id == resource_id]

        if start_date:
            results = [e for e in results if e.timestamp >= start_date]

        if end_date:
            results = [e for e in results if e.timestamp <= end_date]

        # Sort by timestamp descending (most recent first)
        results.sort(key=lambda e: e.timestamp, reverse=True)

        # Paginate
        return results[offset:offset + limit]

    async def verify_integrity(self) -> Dict[str, Any]:
        """
        Verify integrity of audit trail using hash chain

        This checks that:
        1. Each entry's hash is correctly calculated
        2. The hash chain is unbroken
        3. No entries have been modified

        Returns:
            Dict with verification results
        """
        logger.info("Starting audit trail integrity verification")

        total_entries = len(self.audit_entries)
        verified_count = 0
        errors = []

        previous_hash = None

        for idx, entry in enumerate(self.audit_entries):
            # Verify hash chain
            if entry.previous_hash != previous_hash:
                errors.append({
                    "audit_id": entry.audit_id,
                    "error": "Hash chain broken",
                    "expected_previous": previous_hash,
                    "actual_previous": entry.previous_hash
                })
                continue

            # Verify entry hash
            calculated_hash = entry.calculate_hash(previous_hash)
            if calculated_hash != entry.current_hash:
                errors.append({
                    "audit_id": entry.audit_id,
                    "error": "Hash mismatch - entry has been tampered with",
                    "expected_hash": entry.current_hash,
                    "calculated_hash": calculated_hash
                })
                continue

            verified_count += 1
            previous_hash = entry.current_hash

        integrity_passed = len(errors) == 0

        result = {
            "integrity_passed": integrity_passed,
            "total_entries": total_entries,
            "verified_entries": verified_count,
            "errors": errors,
            "verification_time": datetime.utcnow().isoformat()
        }

        if integrity_passed:
            logger.info(f"Audit trail integrity verified: {total_entries} entries OK")
        else:
            logger.error(f"Audit trail integrity FAILED: {len(errors)} errors found")

        return result

    async def get_user_activity(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get activity summary for a user

        Args:
            user_id: User to get activity for
            start_date: Start of period
            end_date: End of period

        Returns:
            Dict with activity summary
        """
        entries = await self.get_audit_trail(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            limit=10000  # Get all for summary
        )

        # Count by action type
        action_counts = {}
        for entry in entries:
            action_counts[entry.action] = action_counts.get(entry.action, 0) + 1

        # Count successes/failures
        successes = sum(1 for e in entries if e.success)
        failures = sum(1 for e in entries if not e.success)

        return {
            "user_id": user_id,
            "period_start": start_date.isoformat() if start_date else None,
            "period_end": end_date.isoformat() if end_date else None,
            "total_actions": len(entries),
            "successful_actions": successes,
            "failed_actions": failures,
            "actions_by_type": action_counts,
            "first_action": entries[-1].timestamp.isoformat() if entries else None,
            "last_action": entries[0].timestamp.isoformat() if entries else None
        }

    async def get_resource_history(
        self,
        resource_type: str,
        resource_id: str
    ) -> List[AuditEntry]:
        """
        Get complete change history for a resource

        Args:
            resource_type: Type of resource
            resource_id: Resource identifier

        Returns:
            List of all audit entries for the resource, oldest first
        """
        entries = await self.get_audit_trail(
            resource_type=resource_type,
            resource_id=resource_id,
            limit=10000
        )

        # Reverse to get chronological order
        return list(reversed(entries))

    async def export_audit_trail(
        self,
        start_date: datetime,
        end_date: datetime,
        format: str = "json"
    ) -> str:
        """
        Export audit trail for regulatory inspection

        Args:
            start_date: Start of period
            end_date: End of period
            format: Export format (json, csv, pdf)

        Returns:
            Exported audit trail content
        """
        entries = await self.get_audit_trail(
            start_date=start_date,
            end_date=end_date,
            limit=100000
        )

        if format == "json":
            import json
            return json.dumps(
                [entry.dict() for entry in entries],
                indent=2,
                default=str
            )

        elif format == "csv":
            import csv
            import io

            output = io.StringIO()
            if entries:
                writer = csv.DictWriter(output, fieldnames=entries[0].dict().keys())
                writer.writeheader()
                for entry in entries:
                    writer.writerow(entry.dict())

            return output.getvalue()

        else:
            raise ValueError(f"Unsupported export format: {format}")

    def _generate_change_summary(
        self,
        action: AuditAction,
        resource_type: Optional[str],
        resource_id: Optional[str],
        before_state: Optional[Dict[str, Any]],
        after_state: Optional[Dict[str, Any]]
    ) -> str:
        """Generate human-readable change summary"""
        summary_parts = [action.value]

        if resource_type and resource_id:
            summary_parts.append(f"{resource_type}/{resource_id}")

        if before_state and after_state:
            # Identify what changed
            changes = []
            for key in set(list(before_state.keys()) + list(after_state.keys())):
                before_val = before_state.get(key)
                after_val = after_state.get(key)

                if before_val != after_val:
                    changes.append(f"{key}: {before_val} → {after_val}")

            if changes:
                summary_parts.append(f"Changes: {', '.join(changes)}")

        return " | ".join(summary_parts)


# Global service instance
_audit_trail_service = None


def get_audit_trail_service() -> AuditTrailService:
    """Get or create audit trail service singleton"""
    global _audit_trail_service
    if _audit_trail_service is None:
        _audit_trail_service = AuditTrailService()
    return _audit_trail_service
