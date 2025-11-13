"""
Code Review API Routes
Endpoints for code review and approval workflow
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from app.models.review import (
    CodeReview, ReviewSubmissionRequest, ReviewActionRequest,
    ReviewCommentRequest, ReviewUpdateRequest, ReviewStats,
    ReviewStatus, ReviewPriority
)
from app.core.review_service import get_review_service
from app.core.auth import get_current_user, require_role

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("/submit", response_model=CodeReview)
async def submit_for_review(
    request: ReviewSubmissionRequest,
    current_user = Depends(get_current_user)
):
    """Submit code for senior developer review"""
    service = get_review_service()
    
    review = service.create_review(
        variable_name=request.variable_name,
        dataset=request.dataset,
        language=request.language,
        code=request.code,
        submitter_id=current_user["username"],
        submitter_name=current_user["full_name"],
        specification=request.specification,
        priority=request.priority,
        tags=request.tags,
        is_urgent=request.is_urgent
    )
    
    return review


@router.get("/list", response_model=List[CodeReview])
async def list_reviews(
    status: Optional[str] = None,
    dataset: Optional[str] = None,
    priority: Optional[str] = None,
    is_urgent: Optional[bool] = None,
    current_user = Depends(get_current_user)
):
    """List code reviews with filters"""
    service = get_review_service()
    
    status_enum = ReviewStatus(status) if status else None
    priority_enum = ReviewPriority(priority) if priority else None
    
    # Regular users see only their submissions
    # Senior devs/admins see all reviews
    if current_user["role"] in ["senior_developer", "admin"]:
        reviews = service.list_reviews(
            status=status_enum,
            dataset=dataset,
            priority=priority_enum,
            is_urgent=is_urgent
        )
    else:
        reviews = service.list_reviews(
            submitter_id=current_user["username"],
            status=status_enum,
            dataset=dataset,
            priority=priority_enum
        )
    
    return reviews


@router.get("/{review_id}", response_model=CodeReview)
async def get_review(
    review_id: str,
    current_user = Depends(get_current_user)
):
    """Get specific code review"""
    service = get_review_service()
    review = service.get_review(review_id)
    
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    # Check access permissions
    if current_user["role"] not in ["senior_developer", "admin"]:
        if review.submitter_id != current_user["username"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    return review


@router.post("/{review_id}/action", response_model=CodeReview)
async def review_action(
    review_id: str,
    request: ReviewActionRequest,
    current_user = Depends(require_role("senior_developer"))
):
    """
    Perform review action (approve, reject, request_changes)
    Senior developer or admin only
    """
    service = get_review_service()
    
    reviewer_id = current_user["username"]
    reviewer_name = current_user["full_name"]
    
    if request.action == "approve":
        review = service.approve_review(
            review_id, reviewer_id, reviewer_name, request.comment
        )
    elif request.action == "reject":
        if not request.comment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Comment required for rejection"
            )
        review = service.reject_review(
            review_id, reviewer_id, reviewer_name, request.comment
        )
    elif request.action == "request_changes":
        if not request.comment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Comment required for change request"
            )
        review = service.request_changes(
            review_id, reviewer_id, reviewer_name, request.comment
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid action: {request.action}"
        )
    
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    return review


@router.post("/{review_id}/comment", response_model=CodeReview)
async def add_comment(
    review_id: str,
    request: ReviewCommentRequest,
    current_user = Depends(get_current_user)
):
    """Add comment to code review"""
    service = get_review_service()
    
    service.add_comment(
        review_id,
        current_user["username"],
        current_user["full_name"],
        request.comment,
        request.line_number
    )
    
    review = service.get_review(review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    return review


@router.put("/{review_id}/code", response_model=CodeReview)
async def update_code(
    review_id: str,
    request: ReviewUpdateRequest,
    current_user = Depends(get_current_user)
):
    """Update code in review (creates new version)"""
    service = get_review_service()
    
    review = service.get_review(review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    # Only submitter can update code
    if review.submitter_id != current_user["username"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only submitter can update code"
        )
    
    updated_review = service.update_code(
        review_id,
        request.code,
        current_user["username"],
        request.changes_summary
    )
    
    return updated_review


@router.delete("/{review_id}")
async def delete_review(
    review_id: str,
    current_user = Depends(get_current_user)
):
    """Delete code review"""
    service = get_review_service()
    
    review = service.get_review(review_id)
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    
    # Only submitter or admin can delete
    if current_user["role"] != "admin" and review.submitter_id != current_user["username"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    service.delete_review(review_id)
    
    return {"message": "Review deleted successfully"}


@router.get("/stats/summary", response_model=ReviewStats)
async def get_review_stats(
    current_user = Depends(require_role("senior_developer"))
):
    """Get review statistics (senior developer/admin only)"""
    service = get_review_service()
    return service.get_stats()


@router.get("/pending/mine", response_model=List[CodeReview])
async def get_my_pending_reviews(
    current_user = Depends(require_role("senior_developer"))
):
    """Get pending reviews for current reviewer"""
    service = get_review_service()
    return service.get_pending_for_reviewer(current_user["role"])
