"""
Code Review Models
Database models for code review and approval workflow
"""

from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from enum import Enum


class ReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CHANGES_REQUESTED = "changes_requested"


class ReviewPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class ReviewComment(BaseModel):
    """Comment on a code review"""
    id: str
    reviewer_id: str
    reviewer_name: str
    comment: str
    line_number: Optional[int] = None
    created_at: datetime
    is_resolved: bool = False
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class CodeVersion(BaseModel):
    """Version of code submission"""
    version: int
    code: str
    submitted_at: datetime
    submitted_by: str
    changes_summary: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class CodeReview(BaseModel):
    """Code review for a variable's generated code"""
    id: str
    variable_name: str
    dataset: str  # ADSL, ADAE, etc.
    language: str  # R or SAS
    
    # Submitter info
    submitter_id: str
    submitter_name: str
    submitted_at: datetime
    
    # Current version
    current_version: int = 1
    code: str
    specification: Optional[str] = None
    
    # Review status
    status: ReviewStatus = ReviewStatus.PENDING
    priority: ReviewPriority = ReviewPriority.MEDIUM
    
    # Reviewer info
    reviewer_id: Optional[str] = None
    reviewer_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    
    # Comments and history
    comments: List[ReviewComment] = []
    versions: List[CodeVersion] = []
    
    # Metadata
    tags: List[str] = []
    is_urgent: bool = False
    estimated_review_time: Optional[int] = None  # minutes
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    def add_comment(self, reviewer_id: str, reviewer_name: str, comment: str, 
                    line_number: Optional[int] = None) -> ReviewComment:
        """Add a comment to the review"""
        import uuid
        new_comment = ReviewComment(
            id=str(uuid.uuid4()),
            reviewer_id=reviewer_id,
            reviewer_name=reviewer_name,
            comment=comment,
            line_number=line_number,
            created_at=datetime.now()
        )
        self.comments.append(new_comment)
        return new_comment
    
    def add_version(self, code: str, submitted_by: str, changes_summary: Optional[str] = None):
        """Add a new version of the code"""
        self.current_version += 1
        new_version = CodeVersion(
            version=self.current_version,
            code=code,
            submitted_at=datetime.now(),
            submitted_by=submitted_by,
            changes_summary=changes_summary
        )
        self.versions.append(new_version)
        self.code = code
    
    def approve(self, reviewer_id: str, reviewer_name: str):
        """Approve the code"""
        self.status = ReviewStatus.APPROVED
        self.reviewer_id = reviewer_id
        self.reviewer_name = reviewer_name
        self.reviewed_at = datetime.now()
    
    def reject(self, reviewer_id: str, reviewer_name: str, reason: str):
        """Reject the code"""
        self.status = ReviewStatus.REJECTED
        self.reviewer_id = reviewer_id
        self.reviewer_name = reviewer_name
        self.reviewed_at = datetime.now()
        self.add_comment(reviewer_id, reviewer_name, f"Rejection reason: {reason}")
    
    def request_changes(self, reviewer_id: str, reviewer_name: str, changes: str):
        """Request changes to the code"""
        self.status = ReviewStatus.CHANGES_REQUESTED
        self.reviewer_id = reviewer_id
        self.reviewer_name = reviewer_name
        self.reviewed_at = datetime.now()
        self.add_comment(reviewer_id, reviewer_name, f"Changes requested: {changes}")


class ReviewSubmissionRequest(BaseModel):
    """Request to submit code for review"""
    variable_name: str
    dataset: str
    language: str
    code: str
    specification: Optional[str] = None
    priority: ReviewPriority = ReviewPriority.MEDIUM
    tags: List[str] = []
    is_urgent: bool = False


class ReviewActionRequest(BaseModel):
    """Request to perform review action"""
    action: str  # approve, reject, request_changes
    comment: Optional[str] = None
    changes_summary: Optional[str] = None


class ReviewCommentRequest(BaseModel):
    """Request to add comment to review"""
    comment: str
    line_number: Optional[int] = None


class ReviewUpdateRequest(BaseModel):
    """Request to update code in review"""
    code: str
    changes_summary: str


class ReviewStats(BaseModel):
    """Statistics for code reviews"""
    total_reviews: int
    pending: int
    approved: int
    rejected: int
    changes_requested: int
    avg_review_time: float  # hours
    reviews_by_priority: dict
    reviews_by_dataset: dict
