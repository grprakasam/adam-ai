"""
21 CFR Part 11 Compliance Models
Electronic signatures, audit trails, and data integrity
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum
from pydantic import BaseModel, Field, validator
import hashlib
import json


class AuditAction(str, Enum):
    """Audit trail action types"""
    # User Management
    USER_LOGIN = "USER_LOGIN"
    USER_LOGOUT = "USER_LOGOUT"
    USER_CREATED = "USER_CREATED"
    USER_UPDATED = "USER_UPDATED"
    USER_DELETED = "USER_DELETED"
    PASSWORD_CHANGED = "PASSWORD_CHANGED"
    MFA_ENABLED = "MFA_ENABLED"
    MFA_DISABLED = "MFA_DISABLED"

    # Code Generation
    CODE_GENERATION_STARTED = "CODE_GENERATION_STARTED"
    CODE_GENERATION_COMPLETED = "CODE_GENERATION_COMPLETED"
    CODE_SNIPPET_CREATED = "CODE_SNIPPET_CREATED"
    CODE_SNIPPET_UPDATED = "CODE_SNIPPET_UPDATED"
    CODE_SNIPPET_DELETED = "CODE_SNIPPET_DELETED"
    CODE_SNIPPET_APPROVED = "CODE_SNIPPET_APPROVED"
    CODE_SNIPPET_REJECTED = "CODE_SNIPPET_REJECTED"

    # Program Generation
    PROGRAM_GENERATED = "PROGRAM_GENERATED"
    PROGRAM_APPROVED = "PROGRAM_APPROVED"
    PROGRAM_REJECTED = "PROGRAM_REJECTED"

    # Specification Management
    SPECIFICATION_UPLOADED = "SPECIFICATION_UPLOADED"
    SPECIFICATION_PARSED = "SPECIFICATION_PARSED"
    SPECIFICATION_UPDATED = "SPECIFICATION_UPDATED"
    SPECIFICATION_DELETED = "SPECIFICATION_DELETED"

    # Validation & Review
    VALIDATION_EXECUTED = "VALIDATION_EXECUTED"
    REVIEW_CREATED = "REVIEW_CREATED"
    REVIEW_SUBMITTED = "REVIEW_SUBMITTED"

    # Electronic Signatures
    ELECTRONIC_SIGNATURE_CREATED = "ELECTRONIC_SIGNATURE_CREATED"
    ELECTRONIC_SIGNATURE_VERIFIED = "ELECTRONIC_SIGNATURE_VERIFIED"
    ELECTRONIC_SIGNATURE_REVOKED = "ELECTRONIC_SIGNATURE_REVOKED"

    # Data Integrity
    INTEGRITY_CHECK_PASSED = "INTEGRITY_CHECK_PASSED"
    INTEGRITY_CHECK_FAILED = "INTEGRITY_CHECK_FAILED"
    INTEGRITY_VIOLATION_DETECTED = "INTEGRITY_VIOLATION_DETECTED"

    # System Events
    SYSTEM_BACKUP_STARTED = "SYSTEM_BACKUP_STARTED"
    SYSTEM_BACKUP_COMPLETED = "SYSTEM_BACKUP_COMPLETED"
    SYSTEM_RESTORE_STARTED = "SYSTEM_RESTORE_STARTED"
    SYSTEM_RESTORE_COMPLETED = "SYSTEM_RESTORE_COMPLETED"


class SignatureMeaning(str, Enum):
    """Electronic signature meanings per 21 CFR Part 11"""
    AUTHORED = "authored"
    REVIEWED = "reviewed"
    APPROVED = "approved"
    REJECTED = "rejected"
    VERIFIED = "verified"


class AuditEntry(BaseModel):
    """
    Immutable audit trail entry
    Complies with 21 CFR Part 11.10(e) - Audit trail requirements
    """
    audit_id: str = Field(..., description="Unique audit entry identifier")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    user_id: str = Field(..., description="User who performed the action")
    username: str = Field(..., description="Username for human readability")
    session_id: Optional[str] = Field(None, description="Session identifier")

    action: AuditAction = Field(..., description="Action performed")
    resource_type: Optional[str] = Field(None, description="Type of resource affected")
    resource_id: Optional[str] = Field(None, description="Identifier of affected resource")

    before_state: Optional[Dict[str, Any]] = Field(None, description="State before change")
    after_state: Optional[Dict[str, Any]] = Field(None, description="State after change")
    change_summary: Optional[str] = Field(None, description="Human-readable change summary")

    ip_address: Optional[str] = Field(None, description="IP address of user")
    user_agent: Optional[str] = Field(None, description="Browser/client user agent")

    success: bool = Field(..., description="Whether action succeeded")
    error_message: Optional[str] = Field(None, description="Error message if failed")

    regulatory_reason: Optional[str] = Field(None, description="Reason for change (21 CFR Part 11)")
    e_signature: Optional[str] = Field(None, description="Associated electronic signature")

    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

    # Hash chain for tamper detection (blockchain-style)
    previous_hash: Optional[str] = Field(None, description="Hash of previous audit entry")
    current_hash: str = Field(..., description="Hash of this entry")

    class Config:
        use_enum_values = True

    def calculate_hash(self, previous_hash: Optional[str] = None) -> str:
        """
        Calculate SHA-256 hash for this audit entry
        Creates a blockchain-style hash chain for tamper detection
        """
        hash_input = {
            "timestamp": self.timestamp.isoformat(),
            "user_id": self.user_id,
            "action": self.action,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "success": self.success,
            "previous_hash": previous_hash
        }

        json_str = json.dumps(hash_input, sort_keys=True)
        return hashlib.sha256(json_str.encode()).hexdigest()


class ElectronicSignature(BaseModel):
    """
    Electronic signature per 21 CFR Part 11.50

    Requirements:
    - Unique to one individual
    - Not reused by anyone else
    - Verified by the system
    - Linked to record in a way that cannot be excised, copied, or transferred
    """
    signature_id: str = Field(..., description="Unique signature identifier")
    user_id: str = Field(..., description="User who signed")
    username: str = Field(..., description="Username")
    full_name: str = Field(..., description="Full legal name of signer")

    resource_type: str = Field(..., description="Type of resource signed")
    resource_id: str = Field(..., description="Identifier of signed resource")

    signature_meaning: SignatureMeaning = Field(..., description="Meaning of signature")
    signed_at: datetime = Field(default_factory=datetime.utcnow)

    signature_hash: str = Field(..., description="Cryptographic signature")
    document_hash: str = Field(..., description="Hash of signed document")

    reason: str = Field(..., min_length=10, description="Reason for signing (required by 21 CFR Part 11)")

    ip_address: Optional[str] = Field(None, description="IP address at signing")
    location: Optional[str] = Field(None, description="Physical location if available")

    is_valid: bool = Field(default=True, description="Signature validity")
    revoked_at: Optional[datetime] = Field(None, description="When signature was revoked")
    revoked_by: Optional[str] = Field(None, description="Who revoked the signature")
    revocation_reason: Optional[str] = Field(None, description="Why signature was revoked")

    class Config:
        use_enum_values = True

    @validator('reason')
    def validate_reason(cls, v):
        """Ensure reason is meaningful"""
        if len(v.strip()) < 10:
            raise ValueError("Signature reason must be at least 10 characters")
        return v


class DataIntegrityCheck(BaseModel):
    """
    Data integrity verification record
    Ensures data has not been tampered with
    """
    check_id: str = Field(..., description="Unique check identifier")
    resource_type: str = Field(..., description="Type of resource checked")
    resource_id: str = Field(..., description="Resource identifier")

    checked_at: datetime = Field(default_factory=datetime.utcnow)
    checked_by: str = Field(..., description="User or system that performed check")

    expected_hash: str = Field(..., description="Expected SHA-256 hash")
    actual_hash: str = Field(..., description="Actual calculated hash")

    integrity_passed: bool = Field(..., description="Whether integrity check passed")

    failure_details: Optional[str] = Field(None, description="Details if check failed")

    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional check metadata")


class ValidationRecord(BaseModel):
    """
    System validation record (IQ/OQ/PQ)
    """
    validation_id: str = Field(..., description="Unique validation identifier")
    validation_type: str = Field(..., description="IQ, OQ, or PQ")

    protocol_number: str = Field(..., description="Validation protocol number")
    protocol_version: str = Field(..., description="Protocol version")

    executed_by: str = Field(..., description="Person who executed validation")
    reviewed_by: Optional[str] = Field(None, description="Person who reviewed")
    approved_by: Optional[str] = Field(None, description="Person who approved")

    executed_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None

    status: str = Field(..., description="pass, fail, in_progress")

    test_results: List[Dict[str, Any]] = Field(default_factory=list, description="Individual test results")

    deviations: Optional[List[str]] = Field(None, description="Any deviations from protocol")
    conclusions: Optional[str] = Field(None, description="Validation conclusions")

    e_signatures: List[str] = Field(default_factory=list, description="Associated e-signature IDs")


class ChangeControlRecord(BaseModel):
    """
    Change control record for tracking system changes
    """
    change_id: str = Field(..., description="Unique change identifier")
    change_type: str = Field(..., description="Type of change")

    description: str = Field(..., description="Description of change")
    justification: str = Field(..., description="Business justification")

    impact_assessment: str = Field(..., description="Impact on system and processes")

    requested_by: str = Field(..., description="Who requested change")
    requested_at: datetime = Field(default_factory=datetime.utcnow)

    reviewed_by: Optional[List[str]] = Field(None, description="Reviewers")
    approved_by: Optional[str] = Field(None, description="Approver")

    status: str = Field(default="pending", description="pending, approved, rejected, implemented")

    implementation_date: Optional[datetime] = None
    rollback_plan: Optional[str] = Field(None, description="Plan to rollback if needed")

    verification_method: Optional[str] = Field(None, description="How to verify change worked")
    verification_completed: bool = Field(default=False)

    e_signatures: List[str] = Field(default_factory=list, description="Associated e-signature IDs")


class ComplianceReport(BaseModel):
    """
    Compliance report for regulatory inspections
    """
    report_id: str = Field(..., description="Unique report identifier")
    report_type: str = Field(..., description="Type of compliance report")

    period_start: datetime = Field(..., description="Reporting period start")
    period_end: datetime = Field(..., description="Reporting period end")

    generated_at: datetime = Field(default_factory=datetime.utcnow)
    generated_by: str = Field(..., description="User who generated report")

    total_audit_entries: int = Field(..., description="Total audit entries in period")
    total_e_signatures: int = Field(..., description="Total e-signatures in period")
    total_integrity_checks: int = Field(..., description="Total integrity checks")
    integrity_failures: int = Field(default=0, description="Number of integrity failures")

    user_activity_summary: Dict[str, int] = Field(default_factory=dict)
    action_type_summary: Dict[str, int] = Field(default_factory=dict)

    findings: List[str] = Field(default_factory=list, description="Any compliance findings")
    recommendations: List[str] = Field(default_factory=list, description="Recommendations")

    report_content: Optional[str] = Field(None, description="Full report content")

    e_signature: Optional[str] = Field(None, description="E-signature of report approver")
