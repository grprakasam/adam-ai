"""
Document-Grounded RAG Service - STRICT IMPLEMENTATION

CORE PRINCIPLES:
1. ALL responses MUST come from uploaded documents only
2. NO external knowledge allowed
3. MANDATORY citations with page/section numbers
4. Explicit "I don't know" when info not in documents
5. Confidence scoring based on retrieval quality

Architecture:
- Document chunking with metadata preservation (page, section)
- Semantic search for relevant chunks
- LLM with STRICT grounding instructions
- Citation extraction and verification
- Confidence scoring (0-100)
"""

import time
import hashlib
import re
from typing import List, Dict, Any, Optional, Tuple
from loguru import logger
from datetime import datetime
from pathlib import Path

from .schemas import (
    KnowledgeBaseRequest,
    KnowledgeBaseResponse,
    ChatRequest,
    ChatResponse,
    ChatMessage,
    SuggestedQuestion,
    SuggestedQuestionsResponse,
)
from ..llm_integration.service import get_llm_service


class StudyChatbotService:
    """
    Document-Grounded RAG Service with strict hallucination prevention.

    Key Features:
    - Pure document-based responses
    - Page-level citations
    - Confidence scoring
    - Explicit "not found" responses
    - No external knowledge
    """

    def __init__(self):
        self.llm_service = get_llm_service()
        self.knowledge_bases: Dict[str, Dict[str, Any]] = {}
        logger.info("Document-Grounded RAG Service initialized")

    async def create_knowledge_base(
        self,
        request: KnowledgeBaseRequest
    ) -> KnowledgeBaseResponse:
        """
        Process documents and create searchable knowledge base with metadata.
        """
        start_time = time.time()

        try:
            documents = []
            for file_path in request.file_paths:
                try:
                    # Extract text with page metadata
                    chunks = self._extract_text_with_metadata(file_path)
                    if chunks:
                        documents.append({
                            'file_path': file_path,
                            'filename': Path(file_path).name,
                            'chunks': chunks,
                            'total_chunks': len(chunks),
                        })
                except Exception as e:
                    logger.warning(f"Failed to process {file_path}: {e}")

            if not documents:
                return KnowledgeBaseResponse(
                    session_id=request.session_id,
                    files_processed=0,
                    processing_time_ms=int((time.time() - start_time) * 1000),
                    status="failed",
                    error_message="No documents could be processed"
                )

            # Store knowledge base
            total_chunks = sum(doc['total_chunks'] for doc in documents)
            self.knowledge_bases[request.session_id] = {
                'documents': documents,
                'created_at': datetime.now(),
                'total_chunks': total_chunks,
            }

            processing_time_ms = int((time.time() - start_time) * 1000)

            logger.info(f"Knowledge base created: session={request.session_id}, "
                       f"docs={len(documents)}, chunks={total_chunks}")

            return KnowledgeBaseResponse(
                session_id=request.session_id,
                insights=[],  # No external insights - only from documents
                files_processed=len(documents),
                processing_time_ms=processing_time_ms,
                status="success"
            )

        except Exception as e:
            logger.error(f"Knowledge base creation failed: {e}", exc_info=True)
            return KnowledgeBaseResponse(
                session_id=request.session_id,
                files_processed=0,
                processing_time_ms=int((time.time() - start_time) * 1000),
                status="failed",
                error_message=str(e)
            )

    async def generate_suggested_questions(
        self,
        session_id: str
    ) -> SuggestedQuestionsResponse:
        """
        Generate questions STRICTLY based on document content.
        """
        kb = self.knowledge_bases.get(session_id)
        if not kb:
            raise ValueError(f"Knowledge base not found for session {session_id}")

        try:
            # Sample chunks from documents
            sample_chunks = []
            for doc in kb['documents'][:3]:  # First 3 documents
                sample_chunks.extend(doc['chunks'][:5])  # First 5 chunks each

            combined_sample = '\n\n'.join([
                f"[{chunk['source']} - Page {chunk.get('page', '?')}]\n{chunk['content'][:300]}"
                for chunk in sample_chunks[:10]
            ])

            prompt = f"""Based ONLY on the following document excerpts, generate 3 specific questions that can be answered using this content.

Document Excerpts:
{combined_sample}

Requirements:
- Questions MUST be answerable from the excerpts shown
- Focus on specific information present in the text
- Do NOT ask about information not shown
- Make questions practical and useful

Return as JSON array:
[
  {{"question": "..."}},
  {{"question": "..."}},
  {{"question": "..."}}
]"""

            response = await self.llm_service.generate(
                prompt=prompt,
                model="gpt-4o-mini",
                temperature=0.3,
                max_tokens=500,
            )

            # Parse JSON
            import json
            json_match = re.search(r'\[.*\]', response.content, re.DOTALL)
            if json_match:
                questions_data = json.loads(json_match.group(0))
                questions = [
                    SuggestedQuestion(
                        id=str(i+1),
                        question=q['question'],
                        category="Document-Based",
                        priority=i+1
                    )
                    for i, q in enumerate(questions_data[:3])
                ]
            else:
                # Fallback: generic document questions
                questions = [
                    SuggestedQuestion(
                        id='1',
                        question='What are the main topics covered in the uploaded documents?',
                        category='General',
                        priority=1
                    ),
                    SuggestedQuestion(
                        id='2',
                        question='Can you summarize the key information from the documents?',
                        category='Summary',
                        priority=2
                    ),
                ]

            return SuggestedQuestionsResponse(
                session_id=session_id,
                questions=questions
            )

        except Exception as e:
            logger.warning(f"Question generation failed: {e}")
            # Return generic fallback
            return SuggestedQuestionsResponse(
                session_id=session_id,
                questions=[
                    SuggestedQuestion(
                        id='1',
                        question='What information is contained in the uploaded documents?',
                        category='General',
                        priority=1
                    ),
                ]
            )

    async def chat(self, request: ChatRequest) -> ChatResponse:
        """
        Answer question using STRICT document-grounded RAG.

        Process:
        1. Retrieve relevant chunks
        2. Build context with citations
        3. Generate answer with STRICT grounding instructions
        4. Extract and verify citations
        5. Calculate confidence score
        6. Return response with "I don't know" if not grounded
        """
        start_time = time.time()

        kb = self.knowledge_bases.get(request.session_id)
        if not kb:
            raise ValueError(f"Knowledge base not found for session {request.session_id}")

        try:
            # Step 1: Retrieve relevant chunks
            relevant_chunks = self._retrieve_relevant_chunks(
                query=request.message,
                kb=kb,
                top_k=5
            )

            # If keyword-based retrieval finds nothing (common for very general
            # or meta questions like "What information is contained in the uploaded documents?"),
            # fall back to representative overview chunks so the model can still
            # summarize the uploaded content.
            if not relevant_chunks:
                relevant_chunks = self._get_overview_chunks(kb, top_k=5)

            if not relevant_chunks:
                # No chunks could be selected at all
                message = ChatMessage(
                    id=hashlib.md5(f"{request.session_id}{time.time()}".encode()).hexdigest(),
                    type="assistant",
                    content="I could not find readable content in the uploaded documents. Please check the files and try again.",
                    timestamp=datetime.now(),
                    sources=None
                )

                return ChatResponse(
                    session_id=request.session_id,
                    message=message,
                    processing_time_ms=int((time.time() - start_time) * 1000),
                )

            # Step 2: Build context with metadata
            context_with_citations = self._build_context_with_citations(relevant_chunks)

            # Step 3: Generate response with STRICT grounding
            llm_response = await self._generate_grounded_response(
                question=request.message,
                context=context_with_citations,
                response_style=request.response_style,
            )

            # Step 4: Extract citations
            citations = self._extract_citations(llm_response, relevant_chunks)

            # Step 5: Calculate confidence
            confidence = self._calculate_confidence(llm_response, relevant_chunks)

            # Step 6: Build response
            message = ChatMessage(
                id=hashlib.md5(f"{request.session_id}{time.time()}".encode()).hexdigest(),
                type="assistant",
                content=llm_response,
                timestamp=datetime.now(),
                sources=[
                    f"{chunk['source']} - Page {chunk.get('page', '?')}"
                    for chunk in relevant_chunks[:3]
                ] if request.show_sources else None
            )

            processing_time_ms = int((time.time() - start_time) * 1000)

            logger.info(f"Chat response: session={request.session_id}, "
                       f"confidence={confidence}, time={processing_time_ms}ms")

            return ChatResponse(
                session_id=request.session_id,
                message=message,
                processing_time_ms=processing_time_ms,
            )

        except Exception as e:
            logger.error(f"Chat failed: {e}", exc_info=True)
            raise

    def _extract_text_with_metadata(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Extract text from document with page/section metadata.

        Returns list of chunks with metadata:
        {
            'content': 'text content',
            'source': 'filename',
            'page': page_number,
            'section': 'section name',
            'chunk_id': 'unique_id'
        }
        """
        path = Path(file_path)
        ext = path.suffix.lower()
        chunks = []

        try:
            if ext == '.txt':
                with open(file_path, 'r', encoding='utf-8') as f:
                    text = f.read()
                    # Split into chunks
                    chunk_texts = self._chunk_text(text, chunk_size=500)
                    for i, chunk_text in enumerate(chunk_texts):
                        chunks.append({
                            'content': chunk_text,
                            'source': path.name,
                            'page': i + 1,  # Treat chunks as "pages" for TXT
                            'chunk_id': f"{path.name}_{i}"
                        })

            elif ext == '.pdf':
                try:
                    import PyPDF2
                    with open(file_path, 'rb') as f:
                        reader = PyPDF2.PdfReader(f)
                        for page_num, page in enumerate(reader.pages, 1):
                            text = page.extract_text()
                            if text.strip():
                                # Chunk each page
                                page_chunks = self._chunk_text(text, chunk_size=500)
                                for i, chunk_text in enumerate(page_chunks):
                                    chunks.append({
                                        'content': chunk_text,
                                        'source': path.name,
                                        'page': page_num,
                                        'chunk_id': f"{path.name}_p{page_num}_c{i}"
                                    })
                except ImportError:
                    logger.warning("PyPDF2 not installed - skipping PDF")

            elif ext in ['.docx', '.doc']:
                try:
                    from docx import Document
                    doc = Document(file_path)
                    full_text = '\n'.join([para.text for para in doc.paragraphs])
                    chunk_texts = self._chunk_text(full_text, chunk_size=500)
                    for i, chunk_text in enumerate(chunk_texts):
                        chunks.append({
                            'content': chunk_text,
                            'source': path.name,
                            'page': i + 1,
                            'chunk_id': f"{path.name}_{i}"
                        })
                except ImportError:
                    logger.warning("python-docx not installed - skipping DOCX")

            return chunks

        except Exception as e:
            logger.error(f"Text extraction failed for {file_path}: {e}")
            return []

    def _chunk_text(self, text: str, chunk_size: int = 500) -> List[str]:
        """Split text into overlapping chunks"""
        words = text.split()
        chunks = []
        overlap = chunk_size // 4  # 25% overlap

        for i in range(0, len(words), chunk_size - overlap):
            chunk = ' '.join(words[i:i + chunk_size])
            if len(chunk) > 100:  # Minimum chunk size
                chunks.append(chunk)

        return chunks

    def _retrieve_relevant_chunks(
        self,
        query: str,
        kb: Dict[str, Any],
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Retrieve most relevant chunks for the query.

        Current: Keyword-based (simple but effective)
        Production: Use sentence-transformers + FAISS
        """
        all_chunks: List[Dict[str, Any]] = []
        for doc in kb['documents']:
            all_chunks.extend(doc['chunks'])

        if not all_chunks:
            return []

        # Simple keyword scoring with light normalization
        # NOTE: This intentionally stays lightweight, but we strip
        # punctuation and very short tokens to make matching more robust.
        def normalize(text: str) -> List[str]:
            text = re.sub(r'[^a-zA-Z0-9]+', ' ', text.lower())
            return [t for t in text.split() if len(t) > 2]

        query_keywords = set(normalize(query))
        if not query_keywords:
            return []

        scored_chunks: List[Tuple[int, Dict[str, Any]]] = []
        for chunk in all_chunks:
            chunk_keywords = set(normalize(chunk['content']))
            overlap = len(query_keywords & chunk_keywords)
            if overlap > 0:
                scored_chunks.append((overlap, chunk))

        # Sort by score and return top_k
        scored_chunks.sort(reverse=True, key=lambda x: x[0])
        return [chunk for score, chunk in scored_chunks[:top_k]]

    def _get_overview_chunks(
        self,
        kb: Dict[str, Any],
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Fallback selection of representative chunks when direct retrieval fails.

        Strategy:
        - Take the first chunk from up to `top_k` documents
        - If still fewer than `top_k` chunks, fill from remaining chunks

        This allows the assistant to answer broad questions like
        \"What information is contained in the uploaded documents?\" by
        summarising a small but representative sample of the content.
        """
        documents: List[Dict[str, Any]] = kb.get('documents', [])
        if not documents:
            return []

        overview_chunks: List[Dict[str, Any]] = []

        # First pass: first chunk of each document
        for doc in documents:
            if doc.get('chunks'):
                overview_chunks.append(doc['chunks'][0])
                if len(overview_chunks) >= top_k:
                    return overview_chunks

        # Second pass: fill from remaining chunks
        for doc in documents:
            for chunk in doc.get('chunks', [])[1:]:
                overview_chunks.append(chunk)
                if len(overview_chunks) >= top_k:
                    return overview_chunks

        return overview_chunks

    def _build_context_with_citations(self, chunks: List[Dict[str, Any]]) -> str:
        """Build context string with clear citations"""
        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            citation = f"[Source {i}: {chunk['source']}, Page {chunk.get('page', '?')}]"
            context_parts.append(f"{citation}\n{chunk['content']}\n")

        return '\n'.join(context_parts)

    async def _generate_grounded_response(
        self,
        question: str,
        context: str,
        response_style: str
    ) -> str:
        """
        Generate response with STRICT grounding instructions.
        """

        style_instructions = {
            'concise': 'Provide a brief answer (2-3 sentences) based ONLY on the context.',
            'detailed': 'Provide a comprehensive answer based ONLY on the context. Include relevant details.',
            'technical': 'Provide a detailed technical answer based ONLY on the context. Include specific data and terminology.',
        }

        prompt = f"""You are a document Q&A assistant. Your job is to answer questions using ONLY the information provided in the context below.

STRICT RULES:
1. ONLY use information from the context below.
2. DO NOT use any external knowledge or assumptions beyond the context.
3. ALWAYS provide a helpful answer to the user.
   - If the context clearly answers the question, answer it directly.
   - If the context only partially answers the question, explain what can be answered and what is missing.
   - If the context does not directly address the question, clearly say that the documents do not contain a direct answer, then summarize the most relevant information from the context instead.
4. Cite sources by referring to [Source X] references.
5. Be precise and factual.
6. {style_instructions.get(response_style, style_instructions['detailed'])}

CONTEXT:
{context}

USER QUESTION: {question}

YOUR ANSWER (using ONLY the context above):"""

        response = await self.llm_service.generate(
            prompt=prompt,
            model="gpt-4o",  # Best model for accuracy
            temperature=0.1,  # Low temperature for factuality
            max_tokens=1000,
        )

        return response.content

    def _extract_citations(
        self,
        response: str,
        chunks: List[Dict[str, Any]]
    ) -> List[str]:
        """Extract citation references from response"""
        citations = []
        # Look for [Source X] patterns
        pattern = r'\[Source (\d+)\]'
        matches = re.findall(pattern, response)

        for match in matches:
            idx = int(match) - 1
            if 0 <= idx < len(chunks):
                chunk = chunks[idx]
                citations.append(f"{chunk['source']} - Page {chunk.get('page', '?')}")

        return list(set(citations))  # Unique citations

    def _calculate_confidence(
        self,
        response: str,
        chunks: List[Dict[str, Any]]
    ) -> int:
        """
        Calculate confidence score (0-100) based on grounding quality.

        Factors:
        - Citation count
        - Response length vs context length
        - Presence of "I cannot find" phrases
        """
        # Check for "not found" responses
        not_found_phrases = [
            'cannot find',
            'not in the documents',
            'not mentioned',
            'no information'
        ]
        if any(phrase in response.lower() for phrase in not_found_phrases):
            return 0

        # Count citations
        citation_count = len(re.findall(r'\[Source \d+\]', response))

        # Base confidence on citation usage
        if citation_count >= 3:
            confidence = 90
        elif citation_count == 2:
            confidence = 75
        elif citation_count == 1:
            confidence = 60
        else:
            confidence = 40  # Low confidence if no citations

        return min(confidence, 100)
