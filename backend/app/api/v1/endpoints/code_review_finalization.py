"""
Code Review & Finalization API Endpoints

Endpoints for consolidated program code review workflow.
This is separate from variable-level reviews and focuses on the complete ADAM program.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from loguru import logger
import io

from app.models.input_models import (
    CodeReviewSessionRequest,
    CodeReviewSessionResponse,
    CodeReviewCommentRequest,
    CodeReviewCommentResponse,
    UpdateReviewStatusRequest,
    ExportReviewRequest,
    CodeReviewStatus
)
from app.models.db_models import CodeReviewSessionDB, CodeReviewCommentDB
from app.core.database import get_db

router = APIRouter()


# ============================================================================
# Session Management Endpoints
# ============================================================================

@router.post("/session", response_model=CodeReviewSessionResponse)
async def get_or_create_review_session(
    request: CodeReviewSessionRequest,
    db: Session = Depends(get_db)
):
    """
    Get existing review session or create new one

    Sessions are uniquely identified by (study_id, dataset, language, run_id).
    If a session already exists for this context, it's returned.
    Otherwise, a new session is created.

    Args:
        request: Session request with study/dataset/language/run context
        db: Database session

    Returns:
        CodeReviewSessionResponse with session details
    """
    try:
        logger.info(
            f"Getting/creating review session: study={request.study_id}, "
            f"dataset={request.dataset}, language={request.language}, run_id={request.run_id}"
        )

        # Try to find existing session
        query = db.query(CodeReviewSessionDB).filter(
            CodeReviewSessionDB.study_id == request.study_id,
            CodeReviewSessionDB.dataset == request.dataset,
            CodeReviewSessionDB.language == request.language
        )

        # Handle run_id (can be None)
        if request.run_id:
            query = query.filter(CodeReviewSessionDB.run_id == request.run_id)
        else:
            query = query.filter(CodeReviewSessionDB.run_id.is_(None))

        session = query.first()

        if session:
            logger.info(f"Found existing review session: {session.id}")
        else:
            # Create new session
            session = CodeReviewSessionDB(
                study_id=request.study_id,
                dataset=request.dataset,
                language=request.language,
                run_id=request.run_id,
                status="not_started"
            )
            db.add(session)
            db.commit()
            db.refresh(session)
            logger.info(f"Created new review session: {session.id}")

        return CodeReviewSessionResponse(
            id=session.id,
            study_id=session.study_id,
            dataset=session.dataset,
            language=session.language,
            run_id=session.run_id,
            status=CodeReviewStatus(session.status),
            created_at=session.created_at.isoformat(),
            updated_at=session.updated_at.isoformat()
        )

    except Exception as e:
        logger.error(f"Failed to get/create review session: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to manage review session: {str(e)}"
        )


@router.get("/session/{session_id}", response_model=CodeReviewSessionResponse)
async def get_review_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """
    Get review session by ID

    Args:
        session_id: Session identifier
        db: Database session

    Returns:
        CodeReviewSessionResponse with session details

    Raises:
        HTTPException: If session not found
    """
    try:
        session = db.query(CodeReviewSessionDB).filter(
            CodeReviewSessionDB.id == session_id
        ).first()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Review session {session_id} not found"
            )

        return CodeReviewSessionResponse(
            id=session.id,
            study_id=session.study_id,
            dataset=session.dataset,
            language=session.language,
            run_id=session.run_id,
            status=CodeReviewStatus(session.status),
            created_at=session.created_at.isoformat(),
            updated_at=session.updated_at.isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get review session: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get review session: {str(e)}"
        )


@router.patch("/session/{session_id}/status", response_model=CodeReviewSessionResponse)
async def update_review_status(
    session_id: str,
    request: UpdateReviewStatusRequest,
    db: Session = Depends(get_db)
):
    """
    Update review session status

    Args:
        session_id: Session identifier
        request: New status to set
        db: Database session

    Returns:
        Updated CodeReviewSessionResponse

    Raises:
        HTTPException: If session not found
    """
    try:
        session = db.query(CodeReviewSessionDB).filter(
            CodeReviewSessionDB.id == session_id
        ).first()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Review session {session_id} not found"
            )

        # Update status
        old_status = session.status
        session.status = request.status.value
        session.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(session)

        logger.info(
            f"Updated review session {session_id} status: {old_status} → {request.status.value}"
        )

        return CodeReviewSessionResponse(
            id=session.id,
            study_id=session.study_id,
            dataset=session.dataset,
            language=session.language,
            run_id=session.run_id,
            status=CodeReviewStatus(session.status),
            created_at=session.created_at.isoformat(),
            updated_at=session.updated_at.isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update review status: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update review status: {str(e)}"
        )


# ============================================================================
# Comment Management Endpoints
# ============================================================================

@router.get("/comments", response_model=List[CodeReviewCommentResponse])
async def list_comments(
    session_id: str,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List all comments for a review session

    Args:
        session_id: Session identifier
        status_filter: Optional filter by comment status (open/resolved/dismissed)
        db: Database session

    Returns:
        List of CodeReviewCommentResponse objects
    """
    try:
        query = db.query(CodeReviewCommentDB).filter(
            CodeReviewCommentDB.session_id == session_id
        )

        if status_filter:
            query = query.filter(CodeReviewCommentDB.status == status_filter)

        comments = query.order_by(
            CodeReviewCommentDB.line_number.asc().nullsfirst(),
            CodeReviewCommentDB.created_at.asc()
        ).all()

        return [
            CodeReviewCommentResponse(
                id=comment.id,
                session_id=comment.session_id,
                line_number=comment.line_number,
                variable_name=comment.variable_name,
                text=comment.text,
                author=comment.author,
                role=comment.role,
                status=comment.status,
                created_at=comment.created_at.isoformat()
            )
            for comment in comments
        ]

    except Exception as e:
        logger.error(f"Failed to list comments: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list comments: {str(e)}"
        )


@router.post("/comments", response_model=CodeReviewCommentResponse)
async def create_comment(
    request: CodeReviewCommentRequest,
    db: Session = Depends(get_db)
):
    """
    Create a new comment on the code review

    Args:
        request: Comment creation request
        db: Database session

    Returns:
        Created CodeReviewCommentResponse

    Raises:
        HTTPException: If session not found
    """
    try:
        # Verify session exists
        session = db.query(CodeReviewSessionDB).filter(
            CodeReviewSessionDB.id == request.session_id
        ).first()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Review session {request.session_id} not found"
            )

        # Create comment
        comment = CodeReviewCommentDB(
            session_id=request.session_id,
            line_number=request.line_number,
            variable_name=request.variable_name,
            text=request.text,
            author=request.author or "System",
            role=request.role or "reviewer",
            status="open"
        )

        db.add(comment)
        db.commit()
        db.refresh(comment)

        logger.info(
            f"Created comment {comment.id} on session {request.session_id} "
            f"(line {request.line_number})"
        )

        return CodeReviewCommentResponse(
            id=comment.id,
            session_id=comment.session_id,
            line_number=comment.line_number,
            variable_name=comment.variable_name,
            text=comment.text,
            author=comment.author,
            role=comment.role,
            status=comment.status,
            created_at=comment.created_at.isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create comment: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create comment: {str(e)}"
        )


@router.patch("/comments/{comment_id}", response_model=CodeReviewCommentResponse)
async def update_comment(
    comment_id: str,
    text: Optional[str] = None,
    comment_status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Update comment text or status

    Args:
        comment_id: Comment identifier
        text: Optional new text
        comment_status: Optional new status (open/resolved/dismissed)
        db: Database session

    Returns:
        Updated CodeReviewCommentResponse

    Raises:
        HTTPException: If comment not found
    """
    try:
        comment = db.query(CodeReviewCommentDB).filter(
            CodeReviewCommentDB.id == comment_id
        ).first()

        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Comment {comment_id} not found"
            )

        # Update fields
        if text is not None:
            comment.text = text
        if comment_status is not None:
            comment.status = comment_status

        comment.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(comment)

        logger.info(f"Updated comment {comment_id}")

        return CodeReviewCommentResponse(
            id=comment.id,
            session_id=comment.session_id,
            line_number=comment.line_number,
            variable_name=comment.variable_name,
            text=comment.text,
            author=comment.author,
            role=comment.role,
            status=comment.status,
            created_at=comment.created_at.isoformat()
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update comment: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update comment: {str(e)}"
        )


@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete a comment (soft delete by setting status to 'dismissed')

    For regulatory compliance, we don't hard delete comments.
    Instead, we mark them as dismissed to maintain audit trail.

    Args:
        comment_id: Comment identifier
        db: Database session

    Returns:
        Success message

    Raises:
        HTTPException: If comment not found
    """
    try:
        comment = db.query(CodeReviewCommentDB).filter(
            CodeReviewCommentDB.id == comment_id
        ).first()

        if not comment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Comment {comment_id} not found"
            )

        # Soft delete: mark as dismissed
        comment.status = "dismissed"
        comment.updated_at = datetime.utcnow()

        db.commit()

        logger.info(f"Soft-deleted comment {comment_id} (marked as dismissed)")

        return {"message": "Comment deleted successfully", "id": comment_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete comment: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete comment: {str(e)}"
        )


# ============================================================================
# Export Endpoint (PDF Generation)
# ============================================================================

@router.post("/export")
async def export_review_documentation(
    request: ExportReviewRequest,
    db: Session = Depends(get_db)
):
    """
    Export code review documentation as PDF

    Generates a regulatory-compliant PDF document containing:
    - Study/dataset metadata
    - Consolidated program listing with line numbers
    - Review comments table
    - Review status and approval information

    Args:
        request: Export request with study context and format
        db: Database session

    Returns:
        StreamingResponse with PDF file

    Raises:
        HTTPException: If session not found or export fails
    """
    try:
        # Find review session
        query = db.query(CodeReviewSessionDB).filter(
            CodeReviewSessionDB.study_id == request.study_id,
            CodeReviewSessionDB.dataset == request.dataset,
            CodeReviewSessionDB.language == request.language
        )

        if request.run_id:
            query = query.filter(CodeReviewSessionDB.run_id == request.run_id)
        else:
            query = query.filter(CodeReviewSessionDB.run_id.is_(None))

        session = query.first()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No review session found for the specified context"
            )

        # Load comments if requested
        comments = []
        if request.include_comments:
            comments = db.query(CodeReviewCommentDB).filter(
                CodeReviewCommentDB.session_id == session.id,
                CodeReviewCommentDB.status != "dismissed"
            ).order_by(
                CodeReviewCommentDB.line_number.asc().nullsfirst()
            ).all()

        # Generate PDF (using ReportLab or similar)
        if request.format == "pdf":
            pdf_buffer = _generate_pdf_report(session, comments, request)

            filename = f"code_review_{request.study_id}_{request.dataset}_{request.language}.pdf"

            return StreamingResponse(
                pdf_buffer,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}"
                }
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Export format '{request.format}' not yet implemented. Use 'pdf'."
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to export review documentation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export documentation: {str(e)}"
        )


def _generate_pdf_report(
    session: CodeReviewSessionDB,
    comments: List[CodeReviewCommentDB],
    request: ExportReviewRequest
) -> io.BytesIO:
    """
    Generate PDF report using ReportLab

    Args:
        session: Review session data
        comments: List of comments
        request: Export request with options

    Returns:
        BytesIO buffer with PDF content
    """
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        story = []
        styles = getSampleStyleSheet()

        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=30,
            alignment=TA_CENTER
        )
        story.append(Paragraph("Code Review Report", title_style))
        story.append(Spacer(1, 0.2*inch))

        # Metadata Table
        metadata = [
            ['Study ID:', session.study_id],
            ['Dataset:', session.dataset],
            ['Language:', session.language],
            ['Review Status:', session.status],
            ['Created:', session.created_at.strftime('%Y-%m-%d %H:%M:%S')],
            ['Last Updated:', session.updated_at.strftime('%Y-%m-%d %H:%M:%S')]
        ]

        if session.run_id:
            metadata.insert(3, ['Run ID:', session.run_id])

        metadata_table = Table(metadata, colWidths=[2*inch, 4*inch])
        metadata_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey)
        ]))

        story.append(metadata_table)
        story.append(Spacer(1, 0.3*inch))

        # Comments Section
        if comments:
            story.append(Paragraph(f"Review Comments ({len(comments)})", styles['Heading2']))
            story.append(Spacer(1, 0.1*inch))

            comment_data = [['Line', 'Variable', 'Author', 'Comment', 'Status']]

            for comment in comments:
                comment_data.append([
                    str(comment.line_number) if comment.line_number else 'N/A',
                    comment.variable_name or 'General',
                    comment.author[:20],
                    comment.text[:100] + '...' if len(comment.text) > 100 else comment.text,
                    comment.status
                ])

            comment_table = Table(comment_data, colWidths=[0.5*inch, 1*inch, 1*inch, 3*inch, 0.8*inch])
            comment_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4a4a4a')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))

            story.append(comment_table)
        else:
            story.append(Paragraph("No comments", styles['BodyText']))

        story.append(Spacer(1, 0.3*inch))

        # Footer
        footer_text = f"Generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC by ADAM AI System"
        story.append(Paragraph(footer_text, styles['Italic']))

        # Build PDF
        doc.build(story)
        buffer.seek(0)

        return buffer

    except Exception as e:
        logger.error(f"PDF generation failed: {str(e)}", exc_info=True)
        raise
