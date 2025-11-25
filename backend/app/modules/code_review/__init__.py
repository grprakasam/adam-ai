"""
Code Review Module

Manages code review sessions, variable approval tracking, and reviewer comments.
Provides the backend infrastructure for the Code Review feature.
"""

from .models import (
    VariableApprovalStatus,
    SessionReviewStatus,
    VariableReviewSnapshot,
    CodeReviewComment,
    CodeReviewSession,
    CodeReviewSessionWithVariables,
)

from .service import (
    CodeReviewService,
    get_code_review_service,
)

__all__ = [
    "VariableApprovalStatus",
    "SessionReviewStatus",
    "VariableReviewSnapshot",
    "CodeReviewComment",
    "CodeReviewSession",
    "CodeReviewSessionWithVariables",
    "CodeReviewService",
    "get_code_review_service",
]
