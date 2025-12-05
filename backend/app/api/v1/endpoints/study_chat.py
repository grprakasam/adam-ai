"""
Study Chatbot API Endpoints
RAG-based chatbot for study-specific questions
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from loguru import logger

from app.models.study_models import (
    ChatRequest, ChatResponse, ChatSession, ChatSessionDetail, ChatMessage
)
from app.modules.studies.rag_service import RAGService
from app.core.database import get_db
from app.core.auth import get_current_active_user, User


router = APIRouter(prefix="/studies/{study_id}/chat", tags=["Study Chat"])


def get_rag_service(
    study_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> RAGService:
    """Dependency to get RAGService instance"""
    return RAGService(db, current_user.username)


@router.post("", response_model=ChatResponse)
async def chat(
    study_id: str,
    request: ChatRequest,
    rag_service: RAGService = Depends(get_rag_service)
):
    """
    Chat with study assistant using RAG

    Answers are strictly based on uploaded study documents
    """
    try:
        # Retrieve relevant chunks
        context_chunks = await rag_service.retrieve_relevant_chunks(
            study_id=study_id,
            question=request.message,
            top_k=5
        )

        if not context_chunks:
            # No relevant documents found
            return ChatResponse(
                answer="I don't have any relevant documents to answer this question. Please upload study documents first.",
                citations=[],
                source_document_ids=[],
                session_id="",
                message_id=""
            )

        # Generate answer
        response = await rag_service.generate_answer(
            study_id=study_id,
            question=request.message,
            context_chunks=context_chunks,
            temperature=request.temperature or 0.1
        )

        return response

    except Exception as e:
        logger.error(f"Error in chat: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat failed: {str(e)}"
        )


@router.get("/sessions", response_model=List[ChatSession])
async def list_sessions(
    study_id: str,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List chat sessions for a study"""
    from app.models.db_models import StudyChatSessionDB
    from sqlalchemy import select, func

    stmt = select(StudyChatSessionDB).where(
        StudyChatSessionDB.study_id == study_id
    ).order_by(StudyChatSessionDB.created_at.desc())

    stmt = stmt.offset(skip).limit(limit)
    sessions = db.execute(stmt).scalars().all()

    # Convert to response model
    result = []
    for session_db in sessions:
        # Count messages
        from app.models.db_models import StudyChatMessageDB
        msg_count = db.execute(
            select(func.count(StudyChatMessageDB.id)).where(
                StudyChatMessageDB.session_id == session_db.id
            )
        ).scalar() or 0

        result.append(ChatSession(
            id=session_db.id,
            study_id=session_db.study_id,
            title=session_db.title,
            created_by=session_db.created_by,
            created_at=session_db.created_at,
            message_count=msg_count
        ))

    return result


@router.get("/sessions/{session_id}", response_model=ChatSessionDetail)
async def get_session(
    study_id: str,
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get chat session with full message history"""
    from app.models.db_models import StudyChatSessionDB, StudyChatMessageDB
    from sqlalchemy import select

    # Get session
    session_stmt = select(StudyChatSessionDB).where(
        StudyChatSessionDB.id == session_id,
        StudyChatSessionDB.study_id == study_id
    )
    session_db = db.execute(session_stmt).scalar_one_or_none()

    if not session_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    # Get messages
    messages_stmt = select(StudyChatMessageDB).where(
        StudyChatMessageDB.session_id == session_id
    ).order_by(StudyChatMessageDB.timestamp.asc())

    messages_db = db.execute(messages_stmt).scalars().all()

    # Convert to response model
    messages = []
    for msg_db in messages_db:
        messages.append(ChatMessage(
            id=msg_db.id,
            role=msg_db.role,
            content=msg_db.content,
            timestamp=msg_db.timestamp,
            source_document_ids=msg_db.source_document_ids,
            model_used=msg_db.model_used,
            tokens_used=msg_db.tokens_used
        ))

    return ChatSessionDetail(
        id=session_db.id,
        study_id=session_db.study_id,
        title=session_db.title,
        created_by=session_db.created_by,
        created_at=session_db.created_at,
        message_count=len(messages),
        messages=messages
    )




