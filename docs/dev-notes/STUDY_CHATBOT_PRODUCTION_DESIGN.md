# Study Chatbot - Production-Grade RAG Architecture

## Design Philosophy: Zero Hallucination, Maximum Accuracy

This document outlines the production-grade architecture for a document-grounded AI assistant specifically designed for clinical trial programmers working with protocols, SAPs, and study documents.

## Core Principles

1. **100% Document Fidelity**: Every answer must be traceable to uploaded documents
2. **Verifiable Citations**: Each claim backed by exact text from source with page/section
3. **Confidence Transparency**: Clear scoring on answer quality and grounding
4. **Clinical Domain Awareness**: Understanding of CDISC, endpoints, populations, etc.
5. **Programmer-First UX**: Fast, accurate, with code-ready outputs

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                          │
│  - Streaming chat UI with real-time responses                │
│  - Citation highlighting and source preview                  │
│  - Confidence visualization and grounding indicators         │
│  - Query history and context awareness                       │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                      API GATEWAY                             │
│  - WebSocket for streaming                                   │
│  - Session management and auth                               │
│  - Rate limiting and caching                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                   ORCHESTRATION LAYER                        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  1. QUERY PREPROCESSING                             │    │
│  │     - Intent classification                         │    │
│  │     - Entity extraction (endpoints, populations)    │    │
│  │     - Query expansion and rewriting                 │    │
│  │     - Context injection from history                │    │
│  └────────────────────────────────────────────────────┘    │
│                            ↓                                 │
│  ┌────────────────────────────────────────────────────┐    │
│  │  2. RETRIEVAL (Hybrid Search)                      │    │
│  │     - Semantic search (embeddings + FAISS)         │    │
│  │     - Keyword search (BM25)                        │    │
│  │     - Metadata filtering                           │    │
│  │     - Re-ranking (cross-encoder)                   │    │
│  └────────────────────────────────────────────────────┘    │
│                            ↓                                 │
│  ┌────────────────────────────────────────────────────┐    │
│  │  3. CONTEXT BUILDING                               │    │
│  │     - Chunk deduplication                          │    │
│  │     - Context compression (if needed)              │    │
│  │     - Citation metadata attachment                 │    │
│  └────────────────────────────────────────────────────┘    │
│                            ↓                                 │
│  ┌────────────────────────────────────────────────────┐    │
│  │  4. GENERATION (Strict Grounding)                  │    │
│  │     - Structured prompt with citations             │    │
│  │     - Temperature: 0.0-0.1 (deterministic)         │    │
│  │     - Streaming output                             │    │
│  │     - Token-by-token verification                  │    │
│  └────────────────────────────────────────────────────┘    │
│                            ↓                                 │
│  ┌────────────────────────────────────────────────────┐    │
│  │  5. VERIFICATION & SCORING                         │    │
│  │     - Citation verification (text matching)        │    │
│  │     - Grounding score calculation                  │    │
│  │     - Self-consistency check                       │    │
│  │     - Hallucination detection                      │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                   KNOWLEDGE BASE LAYER                       │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  Vector Store    │  │  Document Store  │               │
│  │  (FAISS)         │  │  (Original Text) │               │
│  │  - Embeddings    │  │  - Full text     │               │
│  │  - Fast search   │  │  - Metadata      │               │
│  │  - Clustering    │  │  - Page mapping  │               │
│  └──────────────────┘  └──────────────────┘               │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │  Metadata Index  │  │  Session Store   │               │
│  │  - Document type │  │  - Query history │               │
│  │  - Sections      │  │  - User context  │               │
│  │  - Entities      │  │  - Preferences   │               │
│  └──────────────────┘  └──────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Technologies

### Backend Stack

1. **Embedding Model**: `sentence-transformers/all-MiniLM-L6-v2`
   - Fast (< 50ms per query)
   - High quality semantic understanding
   - 384-dimensional embeddings

2. **Vector Database**: FAISS
   - In-memory for fast access
   - Supports similarity search with cosine distance
   - Efficient for < 10M vectors

3. **Chunking**: LangChain RecursiveCharacterTextSplitter
   - Sentence-aware splitting
   - Preserves structure (markdown, headers)
   - Metadata propagation

4. **LLM**: OpenAI GPT-4o / Anthropic Claude 3.5 Sonnet
   - Best-in-class for accuracy
   - Supports function calling for structured output
   - Temperature 0.1 for deterministic responses

5. **Streaming**: Server-Sent Events (SSE)
   - Real-time token streaming
   - Better UX for long answers

### Frontend Stack

1. **UI Framework**: React + TypeScript + Ant Design
2. **State Management**: Zustand for global state
3. **Streaming**: EventSource API for SSE
4. **Markdown**: react-markdown with syntax highlighting
5. **Citations**: Custom highlight component with tooltips

---

## Advanced Features

### 1. Intelligent Chunking

```python
class IntelligentChunker:
    """
    Smart chunking that preserves document structure and meaning.
    """

    def chunk_document(self, text: str, metadata: dict) -> List[Chunk]:
        # Step 1: Detect structure (headers, sections, lists)
        structure = self.detect_structure(text)

        # Step 2: Split on natural boundaries (sentences, paragraphs)
        chunks = self.split_preserving_structure(text, structure)

        # Step 3: Enrich with metadata
        enriched = self.enrich_metadata(chunks, metadata)

        # Step 4: Add overlap for context continuity
        overlapped = self.add_overlap(enriched, overlap_tokens=50)

        return overlapped
```

### 2. Hybrid Retrieval

```python
class HybridRetriever:
    """
    Combines semantic and keyword search for best results.
    """

    def retrieve(self, query: str, top_k: int = 10) -> List[Chunk]:
        # Semantic search (70% weight)
        semantic_results = self.vector_store.similarity_search(
            query, k=top_k, score_threshold=0.7
        )

        # Keyword search (30% weight)
        keyword_results = self.bm25_search(query, k=top_k)

        # Merge and re-rank
        merged = self.merge_results(semantic_results, keyword_results)
        reranked = self.cross_encoder_rerank(query, merged)

        return reranked[:top_k]
```

### 3. Query Preprocessing

```python
class QueryPreprocessor:
    """
    Enhances queries before retrieval.
    """

    def preprocess(self, query: str, context: dict) -> str:
        # Extract clinical entities
        entities = self.extract_entities(query)  # endpoints, populations, etc.

        # Classify intent
        intent = self.classify_intent(query)  # factual, summary, comparison

        # Expand with synonyms
        expanded = self.expand_query(query, entities)

        # Inject context from previous questions
        contextualized = self.add_context(expanded, context)

        return contextualized
```

### 4. Answer Verification

```python
class AnswerVerifier:
    """
    Verifies answer is grounded in retrieved context.
    """

    def verify(self, answer: str, context: List[Chunk]) -> VerificationResult:
        # Step 1: Extract claims from answer
        claims = self.extract_claims(answer)

        # Step 2: Verify each claim against context
        verifications = []
        for claim in claims:
            grounded = self.verify_claim(claim, context)
            verifications.append(grounded)

        # Step 3: Calculate grounding score
        grounding_score = sum(v.score for v in verifications) / len(verifications)

        # Step 4: Check for hallucinations
        hallucination_detected = grounding_score < 0.7

        return VerificationResult(
            grounding_score=grounding_score,
            verified_claims=verifications,
            hallucination_detected=hallucination_detected
        )
```

### 5. Citation Extraction

```python
class CitationExtractor:
    """
    Extracts and verifies citations from generated answer.
    """

    def extract(self, answer: str, context: List[Chunk]) -> List[Citation]:
        citations = []

        # Find all [Source X] references
        references = re.findall(r'\[Source (\d+)\]', answer)

        for ref_num in references:
            chunk = context[int(ref_num) - 1]

            # Find exact text match
            excerpt = self.find_matching_excerpt(answer, chunk.content)

            citation = Citation(
                source=chunk.metadata['filename'],
                page=chunk.metadata['page'],
                section=chunk.metadata.get('section'),
                excerpt=excerpt,
                confidence=self.calculate_confidence(excerpt, chunk)
            )
            citations.append(citation)

        return citations
```

---

## API Design

### Endpoints

#### 1. Upload Documents
```
POST /api/v1/study-chatbot/upload
Content-Type: multipart/form-data

Request:
- files: List[File]

Response:
{
  "session_id": "uuid",
  "files_uploaded": 3,
  "processing_status": "queued"
}
```

#### 2. Process Documents (with Progress)
```
POST /api/v1/study-chatbot/knowledge-base
Content-Type: application/json

Request:
{
  "session_id": "uuid",
  "file_paths": ["path1", "path2"],
  "processing_options": {
    "chunk_size": 500,
    "chunk_overlap": 50,
    "enable_ocr": false
  }
}

Response:
{
  "session_id": "uuid",
  "status": "processing",
  "progress": {
    "total_files": 3,
    "processed_files": 1,
    "total_chunks": 0,
    "embeddings_created": 0
  }
}
```

#### 3. Get Processing Status
```
GET /api/v1/study-chatbot/status/{session_id}

Response:
{
  "session_id": "uuid",
  "status": "ready",
  "documents": [
    {
      "filename": "protocol.pdf",
      "pages": 45,
      "chunks": 234,
      "entities_extracted": ["ADSL", "Week 12", "300 subjects"]
    }
  ],
  "total_chunks": 650,
  "embeddings_created": 650
}
```

#### 4. Chat (Streaming)
```
POST /api/v1/study-chatbot/chat-stream
Content-Type: application/json

Request:
{
  "session_id": "uuid",
  "message": "What is the primary endpoint?",
  "options": {
    "response_style": "detailed",
    "max_tokens": 1000,
    "temperature": 0.1,
    "include_citations": true
  }
}

Response: Server-Sent Events Stream
event: token
data: {"token": "The"}

event: token
data: {"token": " primary"}

event: citation
data: {"source": "protocol.pdf", "page": 12, "excerpt": "..."}

event: complete
data: {
  "message_id": "uuid",
  "grounding_score": 0.92,
  "citations": [...],
  "processing_time_ms": 1234
}
```

#### 5. Suggested Questions (Context-Aware)
```
GET /api/v1/study-chatbot/suggested-questions/{session_id}
?context=previous_questions

Response:
{
  "session_id": "uuid",
  "questions": [
    {
      "question": "What is the primary endpoint?",
      "category": "Study Design",
      "confidence": 0.95,
      "relevant_docs": ["protocol.pdf"],
      "relevant_sections": ["Section 3.2"]
    }
  ]
}
```

---

## Database Schema

### Session Store
```python
class ChatSession(BaseModel):
    session_id: str
    created_at: datetime
    updated_at: datetime
    documents: List[ProcessedDocument]
    query_history: List[Query]
    user_preferences: dict
    status: str  # "processing", "ready", "error"
```

### Document Store
```python
class ProcessedDocument(BaseModel):
    filename: str
    file_path: str
    file_type: str
    file_size: int
    pages: int
    chunks: List[Chunk]
    metadata: dict
    entities: List[Entity]
    embedding_ids: List[str]
```

### Chunk with Embeddings
```python
class Chunk(BaseModel):
    chunk_id: str
    content: str
    embedding: List[float]  # 384-dim vector
    metadata: ChunkMetadata

class ChunkMetadata(BaseModel):
    source: str
    page: int
    section: str
    chunk_index: int
    parent_doc_id: str
    entities: List[str]
    keywords: List[str]
```

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Document processing | < 10s per 100 pages | TBD |
| Query latency (retrieval) | < 200ms | TBD |
| Query latency (generation) | < 2s for first token | TBD |
| Grounding accuracy | > 95% | TBD |
| Citation precision | > 90% | TBD |
| User satisfaction | > 4.5/5 | TBD |

---

## Security & Compliance

1. **Data Privacy**: All documents stored in user's session, deleted after 24h
2. **No Model Training**: User data never used for model training
3. **Audit Trail**: All queries and answers logged for traceability
4. **Access Control**: Session-based isolation

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- ✅ Basic RAG with keyword search
- ✅ Simple chunking
- ✅ Citation extraction
- ⏳ Sentence-transformers integration
- ⏳ FAISS vector store

### Phase 2: Intelligence (Week 2)
- ⏳ Hybrid retrieval (semantic + keyword)
- ⏳ Query preprocessing
- ⏳ Answer verification
- ⏳ Grounding score calculation

### Phase 3: Production (Week 3)
- ⏳ Streaming responses
- ⏳ Session management
- ⏳ Performance optimization
- ⏳ Monitoring and logging

### Phase 4: Enhancement (Week 4)
- ⏳ Multi-document synthesis
- ⏳ Table/figure extraction
- ⏳ Conversational memory
- ⏳ Query suggestions

---

## Success Metrics

1. **Accuracy**: 95%+ of answers verifiable in source documents
2. **Speed**: < 2s time to first token
3. **User Satisfaction**: Programmers prefer this over manual search
4. **Adoption**: 80%+ of team uses it daily

---

This is the blueprint for a **world-class document-grounded AI assistant** specifically designed for clinical trial programmers.
