"""
Code Review API Routes

FastAPI endpoints for code review session management, variable approval tracking,
and comment functionality.
"""

from fastapi import APIRouter, HTTPException, status
from loguru import logger
from typing import Optional, Dict, Any, List

from app.modules.code_review.service import get_code_review_service
from app.modules.code_review.models import (
    CodeReviewSession,
    VariableReviewSnapshot,
    CodeReviewComment,
    VariableApprovalStatus,
    SessionReviewStatus,
    CodeReviewSessionWithVariables,
    SetVariableApprovalRequest,
    AddCommentRequest,
    UpdateSessionStatusRequest,
    LoadVariableSnapshotsRequest
)

router = APIRouter(
    prefix="/api/v1/code-review",
    tags=["code-review"]
)


@router.post("/session", response_model=CodeReviewSession)
async def create_code_review_session(
    study_id: str,
    adam_dataset: str,
    programming_language: str
) -> CodeReviewSession:
    """
    Create a new code review session for a study/dataset pair.

    Args:
        study_id: Study identifier
        adam_dataset: ADAM dataset name (ADSL, ADAE, etc.)
        programming_language: Programming language (R or SAS)

    Returns:
        New CodeReviewSession
    """
    try:
        service = get_code_review_service()
        session = service.create_session(
            study_id=study_id,
            adam_dataset=adam_dataset,
            programming_language=programming_language
        )
        logger.info(f"Created code review session: {session.session_id}")
        return session
    except Exception as e:
        logger.error(f"Failed to create code review session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create session: {str(e)}"
        )


@router.get("/session/{session_id}", response_model=CodeReviewSession)
async def get_code_review_session(session_id: str) -> CodeReviewSession:
    """
    Get a specific code review session by ID.

    Args:
        session_id: Code review session ID

    Returns:
        CodeReviewSession
    """
    try:
        service = get_code_review_service()
        session = service.get_session(session_id)

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session not found: {session_id}"
            )

        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve session {session_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve session: {str(e)}"
        )


@router.get("/session/{session_id}/full", response_model=CodeReviewSessionWithVariables)
async def get_code_review_session_with_variables(
    session_id: str
) -> CodeReviewSessionWithVariables:
    """
    Get complete code review session data including all variables and comments.

    Args:
        session_id: Code review session ID

    Returns:
        CodeReviewSessionWithVariables with full data
    """
    try:
        service = get_code_review_service()
        return service.get_session_with_variables(session_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to retrieve session with variables {session_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve session: {str(e)}"
        )


@router.post("/session/{session_id}/load-snapshots", response_model=List[VariableReviewSnapshot])
async def load_variable_snapshots(
    session_id: str,
    request: LoadVariableSnapshotsRequest
) -> List[VariableReviewSnapshot]:
    """
    Load variable snapshots from Pair Programming data into code review.

    Args:
        session_id: Code review session ID
        request: LoadVariableSnapshotsRequest with snippets data

    Returns:
        List of loaded VariableReviewSnapshot objects
    """
    try:
        service = get_code_review_service()
        snapshots = service.load_variable_snapshots(
            session_id=session_id,
            snippets_data=request.variables_data
        )
        logger.info(f"Loaded {len(snapshots)} variable snapshots for session {session_id}")
        return snapshots
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to load variable snapshots: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load snapshots: {str(e)}"
        )


@router.get("/session/{session_id}/variables", response_model=List[VariableReviewSnapshot])
async def get_variable_snapshots(
    session_id: str,
    status: Optional[str] = None
) -> List[VariableReviewSnapshot]:
    """
    Get all variable snapshots for a session, optionally filtered by approval status.

    Args:
        session_id: Code review session ID
        status: Optional status filter (PENDING, APPROVED, CHANGES_REQUESTED)

    Returns:
        List of VariableReviewSnapshot objects
    """
    try:
        service = get_code_review_service()

        status_filter = None
        if status:
            status_filter = VariableApprovalStatus(status)

        snapshots = service.get_variable_snapshots(session_id, status_filter)
        return snapshots
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status value: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Failed to retrieve variable snapshots: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve snapshots: {str(e)}"
        )


@router.post(
    "/session/{session_id}/variables/{variable_name}/status",
    response_model=VariableReviewSnapshot
)
async def set_variable_approval_status(
    session_id: str,
    variable_name: str,
    request: SetVariableApprovalRequest
) -> VariableReviewSnapshot:
    """
    Update approval status for a specific variable.

    Args:
        session_id: Code review session ID
        variable_name: Variable name to update
        request: SetVariableApprovalRequest with new status and optional comments

    Returns:
        Updated VariableReviewSnapshot
    """
    try:
        service = get_code_review_service()
        snapshot = service.set_variable_approval(
            session_id=session_id,
            variable_name=variable_name,
            status=request.status,
            comments=request.comments
        )
        logger.info(
            f"Updated {variable_name} approval status to {request.status} "
            f"in session {session_id}"
        )
        return snapshot
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to update variable approval status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update status: {str(e)}"
        )


@router.post("/session/{session_id}/comments", response_model=CodeReviewComment)
async def add_variable_comment(
    session_id: str,
    request: AddCommentRequest
) -> CodeReviewComment:
    """
    Add a comment to a variable during code review.

    Args:
        session_id: Code review session ID
        request: AddCommentRequest with variable name and comment text

    Returns:
        New CodeReviewComment
    """
    try:
        service = get_code_review_service()
        comment = service.add_comment(
            session_id=session_id,
            variable_name=request.variable_name,
            text=request.text
        )
        logger.info(f"Added comment to {request.variable_name} in session {session_id}")
        return comment
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to add comment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add comment: {str(e)}"
        )


@router.get("/session/{session_id}/comments", response_model=List[CodeReviewComment])
async def get_variable_comments(
    session_id: str,
    variable_name: Optional[str] = None
) -> List[CodeReviewComment]:
    """
    Get comments for a session or specific variable.

    Args:
        session_id: Code review session ID
        variable_name: Optional filter to specific variable

    Returns:
        List of CodeReviewComment objects
    """
    try:
        service = get_code_review_service()
        comments = service.get_comments(session_id, variable_name)
        return comments
    except Exception as e:
        logger.error(f"Failed to retrieve comments: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve comments: {str(e)}"
        )


@router.put("/session/{session_id}/status", response_model=CodeReviewSession)
async def update_session_status(
    session_id: str,
    request: UpdateSessionStatusRequest
) -> CodeReviewSession:
    """
    Update overall code review session status.

    Note: This is typically updated automatically based on variable statuses.
    This endpoint allows explicit status changes if needed.

    Args:
        session_id: Code review session ID
        request: UpdateSessionStatusRequest with new status

    Returns:
        Updated CodeReviewSession
    """
    try:
        service = get_code_review_service()
        session = service.get_session(session_id)

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session not found: {session_id}"
            )

        # Note: In production, this would validate the status transition
        # For MVP, allow any valid transition
        session.status = request.status
        from datetime import datetime
        session.updated_at = datetime.utcnow()

        if request.status == SessionReviewStatus.APPROVED:
            session.completed_at = datetime.utcnow()

        logger.info(f"Updated session {session_id} status to {request.status}")
        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update session status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update status: {str(e)}"
        )
