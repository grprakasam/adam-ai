"""
Background document processing
Extracts text, chunks, and generates embeddings
"""
import os
from pathlib import Path
from typing import Optional
from sqlalchemy.orm import Session
from loguru import logger

from app.models.db_models import StudyDocumentDB, DocumentEmbeddingDB
from app.modules.studies.text_extractor import TextExtractor
from app.modules.studies.text_chunker import TextChunker
from app.modules.studies.embedding_service import EmbeddingService
from app.models.study_models import ProcessingStatus


class DocumentProcessor:
    """Process documents in the background"""

    def __init__(self, db: Session):
        self.db = db
        self.text_extractor = TextExtractor()
        self.text_chunker = TextChunker(chunk_size=500, chunk_overlap=50)
        self.embedding_service = EmbeddingService()

    async def process_document(self, document_id: str):
        """
        Process a document: extract text, chunk, generate embeddings

        Args:
            document_id: Document ID to process
        """
        try:
            # Get document
            from sqlalchemy import select
            stmt = select(StudyDocumentDB).where(StudyDocumentDB.id == document_id)
            document = self.db.execute(stmt).scalar_one_or_none()

            if not document:
                logger.error(f"Document not found: {document_id}")
                return

            # Update status to processing
            document.processing_status = ProcessingStatus.PROCESSING.value
            self.db.commit()

            logger.info(f"Processing document: {document_id} ({document.original_file_name})")

            # Extract text
            try:
                extracted_text = self.text_extractor.extract_text(
                    document.storage_path,
                    document.mime_type
                )
                document.extracted_text = extracted_text
                self.db.commit()
                logger.info(f"Extracted {len(extracted_text)} characters from document")
            except Exception as e:
                logger.error(f"Error extracting text: {e}", exc_info=True)
                document.processing_status = ProcessingStatus.FAILED.value
                document.doc_metadata = document.doc_metadata or {}
                document.doc_metadata["error"] = str(e)
                self.db.commit()
                return

            # Chunk text
            chunks = self.text_chunker.chunk_text(extracted_text)
            logger.info(f"Created {len(chunks)} chunks from document")

            # Generate embeddings for chunks
            chunk_texts = [chunk["text"] for chunk in chunks]
            embeddings = self.embedding_service.generate_embeddings_batch(chunk_texts)

            # Store chunks and embeddings
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                chunk_id = f"{document_id}_chunk_{i}"
                embedding_db = DocumentEmbeddingDB(
                    id=f"embed-{os.urandom(6).hex()}",
                    study_document_id=document_id,
                    chunk_id=chunk_id,
                    chunk_index=chunk["index"],
                    chunk_text=chunk["text"],
                    embedding_vector=embedding,
                    chunk_metadata={
                        "start_pos": chunk.get("start_pos"),
                        "end_pos": chunk.get("end_pos")
                    }
                )
                self.db.add(embedding_db)

            # Update document status and metadata
            document.processing_status = ProcessingStatus.COMPLETED.value
            document.doc_metadata = document.doc_metadata or {}
            document.doc_metadata.update({
                "chunks_count": len(chunks),
                "text_length": len(extracted_text)
            })
            self.db.commit()

            logger.info(f"Successfully processed document: {document_id}")

        except Exception as e:
            logger.error(f"Error processing document {document_id}: {e}", exc_info=True)
            # Update status to failed
            try:
                document = self.db.execute(
                    select(StudyDocumentDB).where(StudyDocumentDB.id == document_id)
                ).scalar_one_or_none()
                if document:
                    document.processing_status = ProcessingStatus.FAILED.value
                    document.doc_metadata = document.doc_metadata or {}
                    document.doc_metadata["error"] = str(e)
                    self.db.commit()
            except Exception as commit_error:
                logger.error(f"Error updating document status: {commit_error}")


async def process_document_background(db: Session, document_id: str):
    """
    Background task wrapper for document processing
    Can be used with FastAPI BackgroundTasks
    """
    processor = DocumentProcessor(db)
    await processor.process_document(document_id)


