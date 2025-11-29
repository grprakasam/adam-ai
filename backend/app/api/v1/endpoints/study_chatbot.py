"""
Study Chatbot API Endpoints

Provides endpoints for RAG-based study assistance chatbot.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Optional
from loguru import logger
import tempfile
import os
from pathlib import Path
import uuid

from app.modules.study_chatbot.schemas import (
    KnowledgeBaseRequest,
    KnowledgeBaseResponse,
    ChatRequest,
    ChatResponse,
    SuggestedQuestionsResponse,
)

# Use advanced service with sentence-transformers and FAISS
try:
    from app.modules.study_chatbot.advanced_service import AdvancedStudyChatbotService
    study_chatbot_service = AdvancedStudyChatbotService()
    logger.info("✅ Using Advanced RAG Service with semantic search")
except Exception as e:
    logger.warning(f"⚠️  Advanced service unavailable: {e}. Falling back to basic service.")
    from app.modules.study_chatbot.service import StudyChatbotService
    study_chatbot_service = StudyChatbotService()

router = APIRouter(prefix="/study-chatbot", tags=["study-chatbot"])


@router.post("/upload", response_model=dict)
async def upload_study_files(
    files: List[UploadFile] = File(...),
):
    """
    Upload study files for knowledge base creation.

    Supports: PDF, DOCX, TXT, CSV, XLSX
    Maximum: 20 files per upload

    Returns:
        dict with session_id and uploaded file paths
    """
    try:
        if len(files) > 20:
            raise HTTPException(
                status_code=400,
                detail="Maximum 20 files allowed per upload"
            )

        # Generate session ID
        session_id = str(uuid.uuid4())

        # Save files to temp directory
        temp_dir = tempfile.gettempdir()
        session_dir = os.path.join(temp_dir, f"study_chatbot_{session_id}")
        os.makedirs(session_dir, exist_ok=True)

        uploaded_files = []
        for file in files:
            # Validate file type
            allowed_extensions = ['.pdf', '.docx', '.doc', '.txt', '.csv', '.xlsx', '.xls']
            file_ext = Path(file.filename or '').suffix.lower()

            if file_ext not in allowed_extensions:
                logger.warning(f"Skipping unsupported file: {file.filename}")
                continue

            # Save file
            file_path = os.path.join(session_dir, file.filename or 'document')
            with open(file_path, 'wb') as f:
                content = await file.read()
                f.write(content)

            uploaded_files.append({
                'filename': file.filename,
                'path': file_path,
                'size': len(content),
                'type': file_ext
            })

        logger.info(f"Session {session_id}: Uploaded {len(uploaded_files)} files")

        return {
            "session_id": session_id,
            "files_uploaded": len(uploaded_files),
            "files": uploaded_files,
        }

    except Exception as e:
        logger.error(f"File upload failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Upload failed: {str(e)}"
        )


@router.post("/knowledge-base", response_model=KnowledgeBaseResponse)
async def create_knowledge_base(
    request: KnowledgeBaseRequest,
):
    """
    Process uploaded files and create knowledge base.

    Steps:
    1. Extract text from all files
    2. Parse and analyze content
    3. Generate metadata (study ID, phase, endpoints, etc.)
    4. Create knowledge base for RAG
    5. Generate insights

    Example request:
    ```json
    {
        "session_id": "uuid-here",
        "file_paths": ["/tmp/protocol.pdf", "/tmp/sap.docx"]
    }
    ```
    """
    try:
        result = await study_chatbot_service.create_knowledge_base(request)
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Knowledge base creation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create knowledge base: {str(e)}"
        )


@router.get("/suggested-questions/{session_id}", response_model=SuggestedQuestionsResponse)
async def get_suggested_questions(
    session_id: str,
):
    """
    Get 5 auto-generated suggested questions based on the knowledge base.

    Questions are categorized by:
    - Study Design
    - Study Population
    - Timeline
    - Data Management
    - Safety/Efficacy

    Args:
        session_id: Session identifier

    Returns:
        SuggestedQuestionsResponse with 5 questions
    """
    try:
        result = await study_chatbot_service.generate_suggested_questions(session_id)
        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Question generation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate questions: {str(e)}"
        )


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
):
    """
    Chat with the study assistant using RAG.

    The assistant will:
    1. Retrieve relevant context from knowledge base
    2. Use LLM to generate accurate response
    3. Include source citations (if enabled)
    4. Format response according to style preference

    Example request:
    ```json
    {
        "session_id": "uuid-here",
        "message": "What is the primary endpoint?",
        "response_style": "detailed",
        "language": "en",
        "show_sources": true
    }
    ```
    """
    try:
        result = await study_chatbot_service.chat(request)
        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Chat failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Chat failed: {str(e)}"
        )


@router.delete("/session/{session_id}")
async def delete_session(
    session_id: str,
):
    """
    Delete a chatbot session and clean up files.

    Args:
        session_id: Session identifier

    Returns:
        Success message
    """
    try:
        # Clean up temp files
        temp_dir = tempfile.gettempdir()
        session_dir = os.path.join(temp_dir, f"study_chatbot_{session_id}")

        if os.path.exists(session_dir):
            import shutil
            shutil.rmtree(session_dir)

        # Remove from service memory
        if hasattr(study_chatbot_service, 'knowledge_bases'):
            study_chatbot_service.knowledge_bases.pop(session_id, None)

        logger.info(f"Session {session_id} deleted")

        return {
            "status": "success",
            "message": f"Session {session_id} deleted successfully"
        }

    except Exception as e:
        logger.error(f"Session deletion failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete session: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Health check endpoint for study chatbot service"""
    return {
        "status": "healthy",
        "service": "study-chatbot",
        "features": [
            "Multi-format document processing",
            "RAG-based question answering",
            "Auto-generated suggested questions",
            "Multiple response styles",
            "Source citations"
        ],
        "supported_formats": ["PDF", "DOCX", "TXT", "CSV", "XLSX"],
    }
