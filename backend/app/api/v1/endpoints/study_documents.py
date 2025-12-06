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


@router.get("/{document_id}/download")
async def download_document(
    study_id: str,
    document_id: str,
    document_service: DocumentService = Depends(get_document_service)
):
    """
    Download a document file
    
    Returns the file content with appropriate headers
    """
    from fastapi.responses import FileResponse
    from pathlib import Path
    
    document = await document_service.get_document(study_id, document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    file_path = Path(document.storage_path)
    # If path is relative, resolve it relative to backend directory
    if not file_path.is_absolute():
        # Get backend directory (study_documents.py -> endpoints -> v1 -> api -> app -> backend)
        current_file = Path(__file__).resolve()
        backend_dir = current_file.parent.parent.parent.parent.parent
        file_path = backend_dir / file_path

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file not found on server"
        )
    
    return FileResponse(
        path=str(file_path),
        filename=document.original_file_name,
        media_type=document.mime_type or "application/octet-stream"
    )


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


@router.post("/check-duplicate")
async def check_duplicate(
    study_id: str,
    filename: str = Form(...),
    file_size: int = Form(0),
    file_hash: Optional[str] = Form(None),
    document_service: DocumentService = Depends(get_document_service)
):
    """
    Check if a file might be a duplicate before uploading
    
    Returns duplicate candidates with confidence scores
    """
    import hashlib
    from difflib import SequenceMatcher
    
    # Get existing documents for this study
    existing_docs = await document_service.list_documents(
        study_id=study_id,
        active_only=True,
        skip=0,
        limit=100
    )
    
    duplicates = []
    
    for doc in existing_docs:
        confidence = 0
        match_type = None
        
        # Check 1: Exact filename match (case-insensitive)
        if doc.original_file_name.lower() == filename.lower():
            confidence = 90
            match_type = "exact_name"
        
        # Check 2: Similar filename (Levenshtein-like)
        elif doc.original_file_name and filename:
            similarity = SequenceMatcher(
                None, 
                doc.original_file_name.lower(), 
                filename.lower()
            ).ratio()
            
            if similarity >= 0.8:  # 80% similar
                confidence = int(similarity * 100)
                match_type = "similar_name"
        
        # Check 3: Same file size and extension (might be renamed duplicate)
        if not match_type and file_size > 0:
            doc_ext = doc.original_file_name.rsplit('.', 1)[-1].lower() if '.' in doc.original_file_name else ''
            new_ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
            
            if doc_ext == new_ext and doc.size_bytes:
                size_diff = abs(doc.size_bytes - file_size) / max(doc.size_bytes, file_size, 1)
                if size_diff < 0.05:  # Within 5% size difference
                    confidence = 60
                    match_type = "same_size_type"
        
        if match_type and confidence >= 50:
            duplicates.append({
                "document_id": doc.id,
                "filename": doc.original_file_name,
                "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
                "match_type": match_type,
                "confidence": confidence,
                "size_bytes": doc.size_bytes,
                "document_type": doc.document_type.value if doc.document_type else None
            })
    
    # Sort by confidence (highest first)
    duplicates.sort(key=lambda x: x["confidence"], reverse=True)
    
    # Determine recommended action
    recommended_action = "upload"
    if duplicates:
        top_confidence = duplicates[0]["confidence"]
        if top_confidence >= 90:
            recommended_action = "replace"
        elif top_confidence >= 70:
            recommended_action = "review"
        else:
            recommended_action = "keep_both"
    
    return {
        "has_duplicates": len(duplicates) > 0,
        "duplicates": duplicates[:5],  # Return top 5
        "recommended_action": recommended_action,
        "message": f"Found {len(duplicates)} potential duplicate(s)" if duplicates else "No duplicates found"
    }
