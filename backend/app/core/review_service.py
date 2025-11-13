"""
Code Review Service
Manages code review workflow and approval process
"""

from typing import List, Optional, Dict
from datetime import datetime, timedelta
import uuid
from app.models.review import (
    CodeReview, ReviewStatus, ReviewPriority, ReviewComment,
    ReviewStats
)
from loguru import logger


class ReviewService:
    """
    Service for managing code reviews
    In production, this would use a database like PostgreSQL
    """
    
    def __init__(self):
        # In-memory storage (replace with database in production)
        self.reviews: Dict[str, CodeReview] = {}
        logger.info("ReviewService initialized")
    
    def create_review(
        self,
        variable_name: str,
        dataset: str,
        language: str,
        code: str,
        submitter_id: str,
        submitter_name: str,
        specification: Optional[str] = None,
        priority: ReviewPriority = ReviewPriority.MEDIUM,
        tags: List[str] = None,
        is_urgent: bool = False
    ) -> CodeReview:
        """Create a new code review"""
        review_id = str(uuid.uuid4())
        
        review = CodeReview(
            id=review_id,
            variable_name=variable_name,
            dataset=dataset,
            language=language,
            submitter_id=submitter_id,
            submitter_name=submitter_name,
            submitted_at=datetime.now(),
            code=code,
            specification=specification,
            priority=priority,
            tags=tags or [],
            is_urgent=is_urgent
        )
        
        self.reviews[review_id] = review
        logger.info(f"Created review {review_id} for {variable_name} by {submitter_name}")
        
        return review
    
    def get_review(self, review_id: str) -> Optional[CodeReview]:
        """Get review by ID"""
        return self.reviews.get(review_id)
    
    def list_reviews(
        self,
        status: Optional[ReviewStatus] = None,
        submitter_id: Optional[str] = None,
        reviewer_id: Optional[str] = None,
        dataset: Optional[str] = None,
        priority: Optional[ReviewPriority] = None,
        is_urgent: Optional[bool] = None
    ) -> List[CodeReview]:
        """List reviews with optional filters"""
        filtered = list(self.reviews.values())
        
        if status:
            filtered = [r for r in filtered if r.status == status]
        
        if submitter_id:
            filtered = [r for r in filtered if r.submitter_id == submitter_id]
        
        if reviewer_id:
            filtered = [r for r in filtered if r.reviewer_id == reviewer_id]
        
        if dataset:
            filtered = [r for r in filtered if r.dataset == dataset]
        
        if priority:
            filtered = [r for r in filtered if r.priority == priority]
        
        if is_urgent is not None:
            filtered = [r for r in filtered if r.is_urgent == is_urgent]
        
        # Sort by priority and submission date
        priority_order = {
            ReviewPriority.URGENT: 0,
            ReviewPriority.HIGH: 1,
            ReviewPriority.MEDIUM: 2,
            ReviewPriority.LOW: 3
        }
        
        filtered.sort(
            key=lambda r: (
                0 if r.is_urgent else 1,
                priority_order.get(r.priority, 999),
                r.submitted_at
            )
        )
        
        return filtered
    
    def add_comment(
        self,
        review_id: str,
        reviewer_id: str,
        reviewer_name: str,
        comment: str,
        line_number: Optional[int] = None
    ) -> Optional[ReviewComment]:
        """Add comment to review"""
        review = self.reviews.get(review_id)
        if not review:
            return None
        
        new_comment = review.add_comment(reviewer_id, reviewer_name, comment, line_number)
        logger.info(f"Added comment to review {review_id} by {reviewer_name}")
        
        return new_comment
    
    def update_code(
        self,
        review_id: str,
        code: str,
        submitter_id: str,
        changes_summary: str
    ) -> Optional[CodeReview]:
        """Update code in review (creates new version)"""
        review = self.reviews.get(review_id)
        if not review:
            return None
        
        review.add_version(code, submitter_id, changes_summary)
        # Reset to pending when code is updated
        review.status = ReviewStatus.PENDING
        review.reviewer_id = None
        review.reviewer_name = None
        review.reviewed_at = None
        
        logger.info(f"Updated code for review {review_id}, version {review.current_version}")
        
        return review
    
    def approve_review(
        self,
        review_id: str,
        reviewer_id: str,
        reviewer_name: str,
        comment: Optional[str] = None
    ) -> Optional[CodeReview]:
        """Approve a code review"""
        review = self.reviews.get(review_id)
        if not review:
            return None
        
        review.approve(reviewer_id, reviewer_name)
        
        if comment:
            review.add_comment(reviewer_id, reviewer_name, comment)
        
        logger.info(f"Review {review_id} approved by {reviewer_name}")
        
        return review
    
    def reject_review(
        self,
        review_id: str,
        reviewer_id: str,
        reviewer_name: str,
        reason: str
    ) -> Optional[CodeReview]:
        """Reject a code review"""
        review = self.reviews.get(review_id)
        if not review:
            return None
        
        review.reject(reviewer_id, reviewer_name, reason)
        logger.info(f"Review {review_id} rejected by {reviewer_name}")
        
        return review
    
    def request_changes(
        self,
        review_id: str,
        reviewer_id: str,
        reviewer_name: str,
        changes: str
    ) -> Optional[CodeReview]:
        """Request changes to code"""
        review = self.reviews.get(review_id)
        if not review:
            return None
        
        review.request_changes(reviewer_id, reviewer_name, changes)
        logger.info(f"Changes requested for review {review_id} by {reviewer_name}")
        
        return review
    
    def delete_review(self, review_id: str) -> bool:
        """Delete a review"""
        if review_id in self.reviews:
            del self.reviews[review_id]
            logger.info(f"Deleted review {review_id}")
            return True
        return False
    
    def get_stats(self) -> ReviewStats:
        """Get review statistics"""
        reviews = list(self.reviews.values())
        
        # Count by status
        status_counts = {
            ReviewStatus.PENDING: 0,
            ReviewStatus.APPROVED: 0,
            ReviewStatus.REJECTED: 0,
            ReviewStatus.CHANGES_REQUESTED: 0
        }
        
        for review in reviews:
            status_counts[review.status] = status_counts.get(review.status, 0) + 1
        
        # Calculate average review time
        reviewed = [r for r in reviews if r.reviewed_at]
        if reviewed:
            review_times = [
                (r.reviewed_at - r.submitted_at).total_seconds() / 3600
                for r in reviewed
            ]
            avg_review_time = sum(review_times) / len(review_times)
        else:
            avg_review_time = 0.0
        
        # Count by priority
        priority_counts = {}
        for review in reviews:
            priority_counts[review.priority.value] = priority_counts.get(review.priority.value, 0) + 1
        
        # Count by dataset
        dataset_counts = {}
        for review in reviews:
            dataset_counts[review.dataset] = dataset_counts.get(review.dataset, 0) + 1
        
        return ReviewStats(
            total_reviews=len(reviews),
            pending=status_counts[ReviewStatus.PENDING],
            approved=status_counts[ReviewStatus.APPROVED],
            rejected=status_counts[ReviewStatus.REJECTED],
            changes_requested=status_counts[ReviewStatus.CHANGES_REQUESTED],
            avg_review_time=round(avg_review_time, 2),
            reviews_by_priority=priority_counts,
            reviews_by_dataset=dataset_counts
        )
    
    def get_pending_for_reviewer(self, reviewer_role: str) -> List[CodeReview]:
        """Get pending reviews for a specific reviewer role"""
        # Senior developers can review everything
        if reviewer_role == "senior_developer" or reviewer_role == "admin":
            return self.list_reviews(status=ReviewStatus.PENDING)
        
        return []


# Global review service instance
_review_service: Optional[ReviewService] = None


def get_review_service() -> ReviewService:
    """Get or create review service instance"""
    global _review_service
    if _review_service is None:
        _review_service = ReviewService()
    return _review_service
