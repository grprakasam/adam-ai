"""
Document processing service for study documents
Handles upload, storage, text extraction, and chunking
"""
import os
import uuid
import hashlib
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import UploadFile, HTTPException, status
from loguru import logger

from app.models.db_models import StudyDocumentDB
from app.models.study_models import DocumentType, ProcessingStatus, StudyDocument, StudyDocumentCreate
from app.modules.studies.document_processor import process_document_background


class DocumentService:
    """Service for managing study documents"""

    @staticmethod
    def _get_backend_dir() -> Path:
        """Get backend directory path consistently"""
        # document_service.py -> studies -> modules -> app -> backend
        current_file = Path(__file__).resolve()
        return current_file.parent.parent.parent.parent

    def __init__(self, db: AsyncSession, current_user_id: str):
        self.db = db
        self.current_user_id = current_user_id
        # Storage base path - resolve relative to backend directory, not CWD
        # This ensures consistent path resolution regardless of where the app is run from
        storage_path_env = os.getenv("DOCUMENT_STORAGE_PATH", "storage/study_documents")
        if Path(storage_path_env).is_absolute():
            self.storage_base = Path(storage_path_env)
        else:
            backend_dir = self._get_backend_dir()
            self.storage_base = backend_dir / storage_path_env

    async def upload_document(
        self,
        study_id: str,
        file: UploadFile,
        document_type: DocumentType,
        version_label: Optional[str] = None,
        tags: Optional[Dict[str, Any]] = None,
        description: Optional[str] = None
    ) -> StudyDocument:
        """
        Upload a document for a study

        Args:
            study_id: Study identifier
            file: Uploaded file
            document_type: Type of document
            version_label: Optional version label
            tags: Optional tags
            description: Optional description

        Returns:
            StudyDocument object
        """
        try:
            # Validate file
            self._validate_file(file)

            # Generate document ID
            doc_id = f"doc-{uuid.uuid4().hex[:12]}"

            # Create storage path
            storage_path = self._create_storage_path(study_id, doc_id, file.filename)

            # Ensure directory exists
            storage_path.parent.mkdir(parents=True, exist_ok=True)

            # Save file
            file_content = await file.read()
            with open(storage_path, "wb") as f:
                f.write(file_content)

            # Calculate file hash
            file_hash = hashlib.sha256(file_content).hexdigest()

            # Get file size
            file_size = len(file_content)

            # Generate download URL
            download_url = f"/api/v1/studies/{study_id}/documents/{doc_id}/download"

            # Store path relative to backend directory for portability
            # This prevents issues when CWD changes (e.g., running from backend/ vs backend/app/)
            backend_dir = self._get_backend_dir()
            try:
                relative_storage_path = storage_path.relative_to(backend_dir)
                storage_path_str = str(relative_storage_path)
            except ValueError:
                # If path is not relative to backend_dir (e.g., absolute path elsewhere), store as-is
                storage_path_str = str(storage_path)

            # Create database record
            doc_db = StudyDocumentDB(
                id=doc_id,
                study_id=study_id,
                document_type=document_type.value,
                file_name=storage_path.name,
                original_file_name=file.filename or "unknown",
                storage_path=storage_path_str,
                storage_url=download_url,  # Set download URL
                mime_type=file.content_type,
                size_bytes=file_size,
                version_label=version_label,
                tags=tags,
                uploaded_by=self.current_user_id,
                uploaded_at=datetime.utcnow(),
                is_active=True,
                processing_status=ProcessingStatus.PENDING.value,
                doc_metadata={
                    "file_hash": file_hash,
                    "description": description
                }
            )

            self.db.add(doc_db)
            await self.db.commit()
            await self.db.refresh(doc_db)

            logger.info(f"Document uploaded: {doc_id} for study {study_id}")

            # Convert to Pydantic model
            return self._db_to_model(doc_db)

        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error uploading document: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload document: {str(e)}"
            )

    async def get_document(self, study_id: str, document_id: str) -> Optional[StudyDocument]:
        """Get a document by ID"""
        stmt = select(StudyDocumentDB).where(
            StudyDocumentDB.id == document_id,
            StudyDocumentDB.study_id == study_id,
            StudyDocumentDB.is_active == True
        )
        result = (await self.db.execute(stmt)).scalar_one_or_none()
        if result:
            return self._db_to_model(result)
        return None

    async def list_documents(
        self,
        study_id: str,
        document_type: Optional[DocumentType] = None,
        active_only: bool = True,
        skip: int = 0,
        limit: int = 50
    ) -> List[StudyDocument]:
        """
        List documents for a study
        
        Returns all active documents for the study, ordered by upload date (newest first)
        """
        try:
            stmt = select(StudyDocumentDB).where(
                StudyDocumentDB.study_id == study_id
            )

            if active_only:
                stmt = stmt.where(StudyDocumentDB.is_active == True)

            if document_type:
                stmt = stmt.where(StudyDocumentDB.document_type == document_type.value)

            stmt = stmt.order_by(StudyDocumentDB.uploaded_at.desc())
            stmt = stmt.offset(skip).limit(limit)

            results = (await self.db.execute(stmt)).scalars().all()
            documents = [self._db_to_model(doc) for doc in results]
            
            logger.info(f"Retrieved {len(documents)} documents for study {study_id}")
            return documents
        except Exception as e:
            logger.error(f"Error listing documents for study {study_id}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to list documents: {str(e)}"
            )

    async def delete_document(self, study_id: str, document_id: str, hard_delete: bool = False) -> bool:
        """Delete a document (soft delete by default)"""
        doc = (await self.db.execute(
            select(StudyDocumentDB).where(
                StudyDocumentDB.id == document_id,
                StudyDocumentDB.study_id == study_id
            )
        )).scalar_one_or_none()

        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )

        if hard_delete:
            # Remove file from storage
            storage_path = Path(doc.storage_path)
            # If path is relative, resolve it relative to backend directory
            if not storage_path.is_absolute():
                storage_path = self._get_backend_dir() / storage_path
            if storage_path.exists():
                storage_path.unlink()
            await self.db.delete(doc)
        else:
            # Soft delete
            doc.is_active = False

        await self.db.commit()
        return True

    async def update_processing_status(
        self,
        document_id: str,
        status: ProcessingStatus,
        extracted_text: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Update document processing status"""
        doc = (await self.db.execute(
            select(StudyDocumentDB).where(StudyDocumentDB.id == document_id)
        )).scalar_one_or_none()

        if doc:
            doc.processing_status = status.value
            if extracted_text:
                doc.extracted_text = extracted_text
            if metadata:
                if doc.doc_metadata:
                    doc.doc_metadata.update(metadata)
                else:
                    doc.doc_metadata = metadata
            await self.db.commit()

    def _validate_file(self, file: UploadFile):
        """Validate uploaded file"""
        # Check file size (50MB max)
        max_size = 50 * 1024 * 1024  # 50MB

        # Allowed extensions
        allowed_extensions = {".pdf", ".docx", ".xlsx", ".txt", ".doc", ".xls"}
        file_ext = Path(file.filename or "").suffix.lower()

        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type not allowed. Allowed: {', '.join(allowed_extensions)}"
            )

    def _create_storage_path(self, study_id: str, doc_id: str, filename: str) -> Path:
        """Create storage path for document"""
        # Structure: storage/study_documents/{study_id}/{doc_id}_{filename}
        safe_filename = "".join(c for c in filename if c.isalnum() or c in ".-_")[:200]
        return self.storage_base / study_id / f"{doc_id}_{safe_filename}"

    def _db_to_model(self, doc_db: StudyDocumentDB) -> StudyDocument:
        """Convert database model to Pydantic model"""
        # Generate download URL if storage_url is not set
        storage_url = doc_db.storage_url
        if not storage_url:
            # Generate relative URL for download endpoint
            storage_url = f"/api/v1/studies/{doc_db.study_id}/documents/{doc_db.id}/download"
        
        # Map doc_metadata (DB field) to metadata (Pydantic field)
        # Only use doc_metadata, NOT the SQLAlchemy .metadata attribute
        metadata = None
        if hasattr(doc_db, 'doc_metadata') and doc_db.doc_metadata is not None:
            if isinstance(doc_db.doc_metadata, dict):
                metadata = doc_db.doc_metadata
        
        return StudyDocument(
            id=doc_db.id,
            study_id=doc_db.study_id,
            document_type=DocumentType(doc_db.document_type),
            file_name=doc_db.file_name,
            original_file_name=doc_db.original_file_name,
            storage_path=doc_db.storage_path,
            storage_url=storage_url,
            mime_type=doc_db.mime_type,
            size_bytes=doc_db.size_bytes,
            version_label=doc_db.version_label,
            tags=doc_db.tags if doc_db.tags else None,
            uploaded_by=doc_db.uploaded_by,
            uploaded_at=doc_db.uploaded_at,
            is_active=doc_db.is_active,
            processing_status=ProcessingStatus(doc_db.processing_status),
            extracted_text=doc_db.extracted_text if doc_db.extracted_text else None,
            metadata=metadata
        )

