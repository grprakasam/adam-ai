"""
Code Review Models

Pydantic models for code review sessions, variable snapshots, and comments.
Used for API validation and data transfer between frontend and backend.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class VariableApprovalStatus(str, Enum):
    """Per-variable approval status"""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"


class SessionReviewStatus(str, Enum):
    """Overall code review session status"""
    NOT_STARTED = "NOT_STARTED"
    IN_REVIEW = "IN_REVIEW"
    CHANGES_REQUESTED = "CHANGES_REQUESTED"
    APPROVED = "APPROVED"


class VariableReviewSnapshot(BaseModel):
    """
    Snapshot of a variable during code review.
    Captures all information needed for domain expert review and approval.
    """

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "variable_name": "AGEGR1",
            "variable_label": "Age Group 1",
            "variable_type": "Char",
            "derivation_logic": "Categorize AGE into groups: <65, 65-80, >80",
            "pseudo_code": "IF AGE < 65 THEN '<65' ELSE IF AGE <= 80 THEN '65-80' ELSE '>80'",
            "pseudo_summary": "Categorize age into three groups",
            "code_snippet": "ADSL$AGEGR1 <- cut(ADSL$AGE, breaks=c(0, 65, 80, Inf))",
            "coding_rationale": "The variable categorizes...",
            "approval_status": "PENDING",
            "user_notes": "Please ensure missing values are handled",
            "reviewer_comments": "Looks good, minor adjustment needed"
        }
    })

    # Variable identification
    variable_name: str = Field(..., description="Variable name (e.g., AGEGR1)")
    variable_label: Optional[str] = Field(None, description="Variable label/description")
    variable_type: Optional[str] = Field(None, description="Variable type (Num, Char, etc.)")

    # Derivation and logic
    derivation_logic: Optional[str] = Field(None, description="Derivation logic from specification")
    pseudo_code: Optional[str] = Field(None, description="Plain English pseudo-code")
    pseudo_summary: Optional[str] = Field(None, description="One-sentence pseudo-code summary")

    # Generated code
    code_snippet: Optional[str] = Field(None, description="Executable code (R or SAS)")
    coding_rationale: Optional[str] = Field(None, description="Explanation of code translation")

    # Review tracking
    approval_status: VariableApprovalStatus = Field(
        default=VariableApprovalStatus.PENDING,
        description="Per-variable approval status"
    )

    # User feedback
    user_notes: Optional[str] = Field(
        None,
        description="User notes from Pair Programming phase"
    )
    reviewer_comments: Optional[str] = Field(
        None,
        description="Reviewer comments/feedback"
    )

    # Metadata
    language: Optional[str] = Field(None, description="Programming language (R or SAS)")
    has_pseudo_code: bool = Field(
        default=False,
        description="Whether pseudo-code was successfully generated"
    )
    created_at: Optional[datetime] = Field(None, description="When snapshot was created")
    updated_at: Optional[datetime] = Field(None, description="When snapshot was last updated")


class CodeReviewComment(BaseModel):
    """
    Comment on a variable during code review.
    Supports threaded discussions per variable.
    """

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "id": "comment_123",
            "variable_name": "AGEGR1",
            "text": "This looks good but please verify edge case handling",
            "author": "reviewer1",
            "created_at": "2025-11-25T10:30:00Z"
        }
    })

    id: Optional[str] = Field(None, description="Unique comment ID")
    variable_name: str = Field(..., description="Variable this comment applies to")
    text: str = Field(..., description="Comment text", min_length=1, max_length=5000)
    author: Optional[str] = Field(None, description="Author of comment (user ID or email)")
    created_at: Optional[datetime] = Field(None, description="When comment was created")
    updated_at: Optional[datetime] = Field(None, description="When comment was last updated")


class CodeReviewSession(BaseModel):
    """
    Code review session for a study/dataset.
    Tracks overall review status and contains variable snapshots.
    """

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "session_id": "session_123",
            "study_id": "STUDY001",
            "adam_dataset": "ADSL",
            "programming_language": "R",
            "status": "IN_REVIEW",
            "total_variables": 25,
            "approved_variables": 18,
            "pending_variables": 5,
            "changes_requested_variables": 2,
            "created_at": "2025-11-25T10:00:00Z",
            "updated_at": "2025-11-25T11:30:00Z"
        }
    })

    # Session identification
    session_id: Optional[str] = Field(None, description="Unique session ID")
    study_id: str = Field(..., description="Study identifier")
    adam_dataset: str = Field(..., description="ADAM dataset name (ADSL, ADAE, etc.)")
    programming_language: str = Field(..., description="Programming language (R or SAS)")

    # Session status
    status: SessionReviewStatus = Field(
        default=SessionReviewStatus.NOT_STARTED,
        description="Overall session review status"
    )

    # Variable counts (denormalized for quick access)
    total_variables: int = Field(
        default=0,
        description="Total number of variables in session"
    )
    approved_variables: int = Field(
        default=0,
        description="Number of approved variables"
    )
    pending_variables: int = Field(
        default=0,
        description="Number of pending variables"
    )
    changes_requested_variables: int = Field(
        default=0,
        description="Number of variables with changes requested"
    )

    # Timestamps
    created_at: Optional[datetime] = Field(None, description="When session was created")
    updated_at: Optional[datetime] = Field(None, description="When session was last updated")
    completed_at: Optional[datetime] = Field(None, description="When session was completed")


class CodeReviewSessionWithVariables(BaseModel):
    """
    Extended session model that includes all variable snapshots.
    Used for fetching full session data.
    """

    session: CodeReviewSession = Field(..., description="Session metadata")
    variables: List[VariableReviewSnapshot] = Field(
        default_factory=list,
        description="All variable snapshots in this session"
    )
    comments: List[CodeReviewComment] = Field(
        default_factory=list,
        description="All comments in this session"
    )


# API Request/Response Models

class SetVariableApprovalRequest(BaseModel):
    """Request to update a variable's approval status"""

    status: VariableApprovalStatus = Field(..., description="New approval status")
    comments: Optional[str] = Field(None, description="Optional reviewer comments")


class AddCommentRequest(BaseModel):
    """Request to add a comment to a variable"""

    variable_name: str = Field(..., description="Variable to comment on")
    text: str = Field(..., description="Comment text", min_length=1, max_length=5000)


class UpdateSessionStatusRequest(BaseModel):
    """Request to update session overall status"""

    status: SessionReviewStatus = Field(..., description="New session status")


class LoadVariableSnapshotsRequest(BaseModel):
    """Request to load variable snapshots from Pair Programming into Code Review"""

    session_id: str = Field(..., description="Session ID")
    variables_data: Dict[str, Any] = Field(
        ...,
        description="Variable data from pairProgramming.snippets"
    )


class ExportCodeReviewRequest(BaseModel):
    """Request to export code review to PDF or other format"""

    session_id: str = Field(..., description="Session ID to export")
    format: str = Field(
        default="pdf",
        description="Export format (pdf, docx, json)"
    )
    include_comments: bool = Field(
        default=True,
        description="Include reviewer comments in export"
    )
