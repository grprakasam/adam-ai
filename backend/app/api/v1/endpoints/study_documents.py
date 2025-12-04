"""
Study Documents API Endpoints
Handles document upload, retrieval, and management for studies
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Request, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from app.models.study_models import (
    StudyDocument, StudyDocumentCreate, DocumentType, ProcessingStatus
)
from app.modules.studies.document_service import DocumentService
from app.modules.studies.document_processor import process_document_background
from app.core.database import get_db
from app.core.auth import get_current_active_user, User


router = APIRouter(prefix="/studies/{study_id}/documents", tags=["Study Documents"])


async def get_document_service(
    study_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> DocumentService:
    """Dependency to get DocumentService instance"""
    return DocumentService(db, current_user.username)


@router.post("", response_model=StudyDocument, status_code=status.HTTP_201_CREATED)
async def upload_document(
    study_id: str,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    version_label: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # JSON string
    description: Optional[str] = Form(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    document_service: DocumentService = Depends(get_document_service),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a document for a study

    Supports: PDF, DOCX, XLSX, TXT
    Max size: 50MB
    """
    try:
        import json
        tags_dict = json.loads(tags) if tags else None

        doc_type = DocumentType(document_type)
        document = await document_service.upload_document(
            study_id=study_id,
            file=file,
            document_type=doc_type,
            version_label=version_label,
            tags=tags_dict,
            description=description
        )

        logger.info(f"Document uploaded: {document.id} for study {study_id}")

        # Trigger background processing
        background_tasks.add_task(process_document_background, db, document.id)
        logger.info(f"Background processing started for document: {document.id}")

        return document

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid document type: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error uploading document: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload document: {str(e)}"
        )


@router.get("", response_model=List[StudyDocument])
async def list_documents(
    study_id: str,
    document_type: Optional[str] = None,
    active_only: bool = True,
    skip: int = 0,
    limit: int = 50,
    document_service: DocumentService = Depends(get_document_service)
):
    """
    List documents for a study

    Supports filtering by document type and pagination
    """
    doc_type = DocumentType(document_type) if document_type else None
    documents = await document_service.list_documents(
        study_id=study_id,
        document_type=doc_type,
        active_only=active_only,
        skip=skip,
        limit=limit
    )
    return documents


@router.get("/{document_id}", response_model=StudyDocument)
async def get_document(
    study_id: str,
    document_id: str,
    document_service: DocumentService = Depends(get_document_service)
):
    """Get a specific document by ID"""
    document = await document_service.get_document(study_id, document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    study_id: str,
    document_id: str,
    hard_delete: bool = False,
    document_service: DocumentService = Depends(get_document_service)
):
    """
    Delete a document (soft delete by default)

    Set hard_delete=true to permanently delete
    """
    await document_service.delete_document(study_id, document_id, hard_delete=hard_delete)
    return None

