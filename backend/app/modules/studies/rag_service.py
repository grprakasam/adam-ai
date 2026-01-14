"""
Retrieval-Augmented Generation (RAG) service for study chatbot
Retrieves relevant document chunks and generates answers using LLM
"""
import os
import re
import uuid
import numpy as np
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from loguru import logger

from app.models.db_models import DocumentEmbeddingDB, StudyDocumentDB, StudyChatSessionDB, StudyChatMessageDB
from app.models.study_models import ChatRequest, ChatResponse, ChatMessage, Citation, ProcessingStatus
from app.modules.llm_integration.service import LLMIntegrationService
from app.modules.studies.embedding_service import EmbeddingService


class RAGService:
    """
    Retrieval-Augmented Generation service for study chatbot
    """

    # Generic query patterns that need expansion
    GENERIC_QUERY_PATTERNS = [
        r'\b(summarize|summarise|summary)\b',
        r'\b(explain|describe|overview)\b',
        r'\b(what is this|tell me about)\b',
        r'\b(document|file|content)\b.*\b(about|contain|describe)\b',
        r'^(what|explain|describe|summarize|summarise)\s+(this|the)\s+(document|file|study)',
    ]

    def __init__(self, db: Session, current_user_id: str):
        self.db = db
        self.current_user_id = current_user_id
        self.embedding_service = EmbeddingService()
        self.llm_service = LLMIntegrationService()

    def _is_generic_query(self, query: str) -> bool:
        """Check if query is a generic document overview request"""
        query_lower = query.lower().strip()
        for pattern in self.GENERIC_QUERY_PATTERNS:
            if re.search(pattern, query_lower, re.IGNORECASE):
                return True
        return False

    def _preprocess_query(self, query: str) -> str:
        """
        Preprocess query for better retrieval.
        Expands generic queries with keywords that match document content better.
        """
        if self._is_generic_query(query):
            # Expand generic query with common document content keywords
            expansion_terms = [
                "study overview",
                "protocol",
                "design",
                "objective",
                "endpoint",
                "population",
                "subject",
                "patient",
                "treatment",
                "analysis",
                "variable",
                "dataset",
                "specification",
                "criteria",
                "schedule",
                "visit"
            ]
            expanded = f"{query} {' '.join(expansion_terms)}"
            logger.info(f"Generic query detected. Expanded: '{query}' -> '{expanded[:100]}...'")
            return expanded
        return query

    async def retrieve_relevant_chunks(
        self,
        study_id: str,
        question: str,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant document chunks for a question using vector similarity

        Args:
            study_id: Study identifier
            question: User's question
            top_k: Number of top chunks to retrieve

        Returns:
            List of relevant chunks with metadata
        """
        try:
            # Check if this is a generic query
            is_generic = self._is_generic_query(question)
            
            # Preprocess query for better retrieval
            processed_query = self._preprocess_query(question)
            
            # Generate embedding for processed question
            question_embedding = self.embedding_service.generate_embedding(processed_query)

            # Get all document embeddings for this study
            # First, get all active documents for the study
            documents_stmt = select(StudyDocumentDB).where(
                StudyDocumentDB.study_id == study_id,
                StudyDocumentDB.is_active == True,
                StudyDocumentDB.processing_status == ProcessingStatus.COMPLETED.value
            )
            documents = self.db.execute(documents_stmt).scalars().all()

            if not documents:
                logger.warning(f"No processed documents found for study {study_id}")
                return []

            document_ids = [doc.id for doc in documents]

            # Get all embeddings for these documents
            embeddings_stmt = select(DocumentEmbeddingDB).where(
                DocumentEmbeddingDB.study_document_id.in_(document_ids)
            )
            all_embeddings = self.db.execute(embeddings_stmt).scalars().all()

            if not all_embeddings:
                logger.warning(f"No embeddings found for study {study_id}")
                return []

            # Calculate cosine similarity for each chunk
            similarities = []
            for embedding_db in all_embeddings:
                if embedding_db.embedding_vector:
                    chunk_embedding = embedding_db.embedding_vector
                    similarity = self._cosine_similarity(question_embedding, chunk_embedding)
                    similarities.append({
                        "embedding": embedding_db,
                        "similarity": similarity
                    })

            # Sort by similarity and get top_k
            similarities.sort(key=lambda x: x["similarity"], reverse=True)
            
            # For generic queries, always return top chunks regardless of similarity score
            # For specific queries, use a minimum threshold but still return something
            if is_generic:
                # Return more chunks for generic/overview queries
                top_chunks = similarities[:min(top_k + 3, len(similarities))]
                logger.info(f"Generic query: returning top {len(top_chunks)} chunks without threshold")
            else:
                # For specific queries, prefer higher similarity but still return something
                # Use a very low threshold (0.1) to ensure we always have context
                MIN_SIMILARITY = 0.1
                top_chunks = [s for s in similarities[:top_k * 2] if s["similarity"] >= MIN_SIMILARITY]
                if not top_chunks and similarities:
                    # Fallback: return top chunks anyway
                    top_chunks = similarities[:top_k]
                    logger.info(f"Low similarity scores, returning top {len(top_chunks)} chunks as fallback")
                else:
                    top_chunks = top_chunks[:top_k]

            # Build result with document references
            results = []
            for item in top_chunks:
                embedding_db = item["embedding"]
                # Get document info
                doc_stmt = select(StudyDocumentDB).where(
                    StudyDocumentDB.id == embedding_db.study_document_id
                )
                doc = self.db.execute(doc_stmt).scalar_one_or_none()

                if doc:
                    results.append({
                        "chunk_id": embedding_db.chunk_id,
                        "chunk_text": embedding_db.chunk_text,
                        "chunk_index": embedding_db.chunk_index,
                        "similarity": item["similarity"],
                        "document_id": doc.id,
                        "document_name": doc.original_file_name,
                        "document_type": doc.document_type,
                        "metadata": embedding_db.metadata or {}
                    })

            logger.info(f"Retrieved {len(results)} relevant chunks for question (generic={is_generic})")
            return results

        except Exception as e:
            logger.error(f"Error retrieving relevant chunks: {e}", exc_info=True)
            return []

    async def generate_answer(
        self,
        study_id: str,
        question: str,
        context_chunks: List[Dict[str, Any]],
        chat_history: Optional[List[ChatMessage]] = None,
        temperature: float = 0.1
    ) -> ChatResponse:
        """
        Generate answer using LLM with strict guardrails

        Args:
            study_id: Study identifier
            question: User's question
            context_chunks: Relevant document chunks
            chat_history: Previous chat messages for context
            temperature: LLM temperature (low for accuracy)

        Returns:
            ChatResponse with answer and citations
        """
        try:
            # Check if this is a generic/summary query
            is_generic = self._is_generic_query(question)
            
            # Build context from chunks
            context_parts = []
            for chunk in context_chunks:
                doc_name = chunk.get("document_name", "Unknown")
                chunk_text = chunk.get("chunk_text", "")
                context_parts.append(f"[Document: {doc_name}]\n{chunk_text}")

            context = "\n\n---\n\n".join(context_parts)

            if is_generic:
                # For generic/overview queries, use a summary-focused prompt
                user_prompt = f"""Based on the following study document excerpts, provide a comprehensive summary/overview.

Question: {question}

Document Excerpts:
{context}

Instructions:
- Provide a structured summary of the key information found in the documents
- Organize the response with clear sections if applicable
- Include any specific details mentioned (study design, endpoints, populations, criteria, etc.)
- Cite the document name when referencing specific information
- If the documents are technical specifications, summarize the structure and key variables
- Provide a useful overview even if the excerpts cover different aspects of the study"""
            else:
                # For specific queries, use the standard prompt
                user_prompt = f"""Based on the following study documents, answer this question:

Question: {question}

Study Documents:
{context}

Instructions:
- Answer ONLY based on the provided documents
- If the information is not in the documents, say "I don't know based on the available documents"
- Cite the document name when referencing information
- Be specific and accurate"""

            # Call LLM
            llm_response = await self.llm_service.generate(
                prompt=user_prompt,
                provider="google",  # Use Google Gemini
                temperature=temperature,
                max_tokens=1500 if is_generic else 1000  # More tokens for summaries
            )

            answer = llm_response.get("content", "I don't know based on the available documents.")


            # Build citations
            citations = []
            source_document_ids = []
            for chunk in context_chunks:
                citation = Citation(
                    document_id=chunk["document_id"],
                    document_name=chunk["document_name"],
                    page_number=chunk.get("metadata", {}).get("page_number"),
                    section=chunk.get("metadata", {}).get("section"),
                    chunk_text=chunk["chunk_text"]  # Full chunk text for source cards
                )
                citations.append(citation)
                logger.info(f"Created citation: doc={citation.document_name}, page={citation.page_number}, section={citation.section}, chunk_len={len(citation.chunk_text or '')}")
                if chunk["document_id"] not in source_document_ids:
                    source_document_ids.append(chunk["document_id"])

            # Create or get chat session
            session_id = await self._get_or_create_session(study_id)

            # Save messages
            message_id = await self._save_messages(
                session_id=session_id,
                question=question,
                answer=answer,
                source_document_ids=source_document_ids,
                citations=[c.dict() for c in citations],
                model_used=llm_response.get("model"),
                tokens_used=llm_response.get("usage", {}).get("total_tokens")
            )

            response = ChatResponse(
                answer=answer,
                citations=citations,
                source_document_ids=source_document_ids,
                session_id=session_id,
                message_id=message_id
            )
            logger.info(f"Returning ChatResponse with {len(citations)} citations, {len(source_document_ids)} source docs")
            return response

        except Exception as e:
            logger.error(f"Error generating answer: {e}", exc_info=True)
            # Return fallback response
            return ChatResponse(
                answer="I encountered an error processing your question. Please try again.",
                citations=[],
                source_document_ids=[],
                session_id="",
                message_id=""
            )

    async def _get_or_create_session(self, study_id: str) -> str:
        """Get or create a chat session for the study"""
        # For now, create a new session each time
        # In future, can implement session management
        session_id = f"chat-session-{uuid.uuid4().hex[:12]}"
        
        session_db = StudyChatSessionDB(
            id=session_id,
            study_id=study_id,
            title=None,
            created_by=self.current_user_id,
            created_at=datetime.utcnow()
        )
        self.db.add(session_db)
        self.db.commit()
        
        return session_id

    async def _save_messages(
        self,
        session_id: str,
        question: str,
        answer: str,
        source_document_ids: List[str],
        citations: Optional[List[Dict[str, Any]]] = None,
        model_used: Optional[str] = None,
        tokens_used: Optional[int] = None
    ) -> str:
        """Save chat messages to database"""
        # Save user message
        user_msg_id = f"chat-msg-{uuid.uuid4().hex[:12]}"
        user_msg = StudyChatMessageDB(
            id=user_msg_id,
            session_id=session_id,
            role="user",
            content=question,
            timestamp=datetime.utcnow()
        )
        self.db.add(user_msg)

        # Save assistant message
        assistant_msg_id = f"chat-msg-{uuid.uuid4().hex[:12]}"
        assistant_msg = StudyChatMessageDB(
            id=assistant_msg_id,
            session_id=session_id,
            role="assistant",
            content=answer,
            timestamp=datetime.utcnow(),
            source_document_ids=source_document_ids,
            citations=citations,
            model_used=model_used,
            tokens_used=tokens_used
        )
        self.db.add(assistant_msg)
        self.db.commit()

        return assistant_msg_id

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors"""
        try:
            vec1_array = np.array(vec1)
            vec2_array = np.array(vec2)
            
            dot_product = np.dot(vec1_array, vec2_array)
            norm1 = np.linalg.norm(vec1_array)
            norm2 = np.linalg.norm(vec2_array)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            return float(dot_product / (norm1 * norm2))
        except Exception as e:
            logger.error(f"Error calculating cosine similarity: {e}")
            return 0.0








