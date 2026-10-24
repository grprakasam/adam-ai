# Study Chatbot - RAG Architecture Design

## Overview

The **Study Chatbot** is a powerful Retrieval-Augmented Generation (RAG) system that provides document-grounded Q&A for clinical study documents. It integrates with real study data from the application or accepts direct file uploads.

## Core Innovation

**"100% Document-Grounded Responses with Full Citation Tracking"**

Every answer comes ONLY from the user's documents. No hallucination, no external knowledge.

## RAG Best Practices Implemented

Based on 2024 industry research, the following best practices are implemented:

### 1. Document Processing

| Practice | Implementation |
|----------|----------------|
| **Chunk Size** | 256-512 tokens optimal for context |
| **Overlap** | 50-token sliding window overlap |
| **Metadata** | Page numbers, sections preserved |
| **Format Support** | PDF, Word, Excel, Text |

### 2. Hybrid Retrieval

| Method | Purpose |
|--------|---------|
| **Semantic Search** | Vector embeddings for meaning |
| **Keyword Search** | BM25 for exact matches |
| **Reranking** | Relevance scoring post-retrieval |

### 3. Response Generation

| Feature | Implementation |
|---------|----------------|
| **Grounding** | LLM only uses retrieved context |
| **Citations** | Every answer includes source refs |
| **Confidence** | 0-100% reliability scoring |
| **Fallback** | Clear "not found" when no match |

### 4. Query Transformation

- Query rewriting for clarity
- Query decomposition for complex questions
- Pseudo-document generation (HyDE approach)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Study Chatbot UI                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐        ┌─────────────────────────────┐   │
│   │ Source Selector │        │       Chat Interface        │   │
│   │                 │        │                             │   │
│   │ ○ Upload Files  │        │  [Messages with Citations]  │   │
│   │ ○ Select Study  │        │                             │   │
│   └────────┬────────┘        └──────────────┬──────────────┘   │
│            │                                │                   │
│            ▼                                ▼                   │
│   ┌─────────────────┐        ┌─────────────────────────────┐   │
│   │ Knowledge Base  │◄──────►│      RAG Pipeline           │   │
│   │                 │        │                             │   │
│   │ - Documents     │        │ 1. Query Transform          │   │
│   │ - Chunks        │        │ 2. Vector Search            │   │
│   │ - Embeddings    │        │ 3. Retrieve Top-K           │   │
│   └─────────────────┘        │ 4. Rerank                   │   │
│                              │ 5. Generate Answer          │   │
│                              │ 6. Add Citations            │   │
│                              └─────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Backend API                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   /api/v1/studies/{id}/documents  - Get study documents        │
│   /api/v1/studies/{id}/chat       - RAG chat endpoint          │
│   /api/v1/study-chatbot/upload    - Direct file upload         │
│   /api/v1/study-chatbot/create-kb - Create knowledge base      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Mode 1: Upload Documents

```
1. User uploads PDF/Word/Text files
   ↓
2. Files validated (type, size)
   ↓
3. Click "Create Knowledge Base"
   ↓
4. Backend extracts text with page metadata
   ↓
5. Text chunked with overlap
   ↓
6. Chunks embedded to vectors
   ↓
7. Knowledge base ready
   ↓
8. User asks questions
   ↓
9. RAG pipeline retrieves + generates
   ↓
10. Response with citations returned
```

### Mode 2: Select Study

```
1. Studies loaded from useStudyStore
   ↓
2. User selects a study (e.g., "Pr1")
   ↓
3. Study documents auto-loaded
   ↓
4. Documents displayed in sidebar
   ↓
5. Click "Create Knowledge Base"
   ↓
6. Documents processed as knowledge base
   ↓
7. Chat uses real /api/v1/studies/{id}/chat
   ↓
8. Citations reference actual document IDs
```

## Store Integration

### useStudyStore

```typescript
// Key functions used
const {
  studies,              // All available studies
  currentStudyId,       // Currently selected study
  documents,            // { studyId: StudyDocument[] }
  loadStudies,          // Fetch all studies
  loadStudyDocuments,   // Fetch docs for a study
  sendChatMessage,      // RAG chat API
} = useStudyStore();
```

### StudyDocument Interface

```typescript
interface StudyDocument {
  id: string;
  study_id: string;
  document_type: string;        // 'protocol', 'sap', 'specification'
  file_name: string;
  original_file_name: string;
  storage_path: string;
  processing_status: string;    // 'pending', 'completed'
  extracted_text?: string;
}
```

## API Endpoints

### Chat Endpoint (Existing)

```
POST /api/v1/studies/{study_id}/chat

Request:
{
  "message": "What are the primary endpoints?",
  "session_id": "optional-session-id",
  "temperature": 0.1
}

Response:
{
  "answer": "Based on the protocol...",
  "citations": [
    {
      "document_id": "doc-123",
      "document_name": "Protocol_v3.pdf",
      "page_number": 45,
      "section": "6.1 Endpoints",
      "chunk_text": "The primary endpoint is..."
    }
  ],
  "source_document_ids": ["doc-123", "doc-456"],
  "session_id": "session-789",
  "message_id": "msg-001"
}
```

## Response Quality

### Confidence Scoring

| Score | Level | Visual | Meaning |
|-------|-------|--------|---------|
| 80-100% | High | 🟢 Green | Strong document match |
| 50-79% | Medium | 🟡 Amber | Partial match |
| 0-49% | Low | 🔴 Red | Weak/no match |

### Grounding Indicator

| Status | Meaning |
|--------|---------|
| ✓ Grounded | Answer derived from documents |
| ⚠ Limited | Partial or uncertain match |
| ❌ Not Found | Information not in documents |

## Smart Features

### 1. Auto-Suggested Questions

Based on document types detected:

| Document Type | Suggested Questions |
|---------------|---------------------|
| Protocol | Endpoints, Eligibility, Treatment |
| SAP | Statistical Methods, Populations |
| Specification | Variables, Derivations |

### 2. Session Continuity

- Chat sessions preserved
- Follow-up questions in context
- Full conversation history

### 3. Multi-Document Search

- Cross-reference multiple documents
- Combine information from sources
- Unified citation tracking

## UI Components

### 1. Source Selector
- Two-card interface
- Clear visual distinction
- Active state indication

### 2. Knowledge Panel
- Document list with icons
- Processing status
- Chunk count metrics

### 3. Chat Interface
- User/Assistant bubbles
- Citation blocks
- Typing indicator
- Keyboard navigation

## File Support

| Format | Extension | Processing |
|--------|-----------|------------|
| PDF | .pdf | Text extraction with OCR |
| Word | .docx, .doc | Document parsing |
| Excel | .xlsx, .xls | Table extraction |
| Text | .txt | Direct text |

## Error Handling

| Scenario | Response |
|----------|----------|
| API failure | Fallback to mock responses |
| No documents | Warning message |
| Empty study | Prompt to upload documents |
| Auth expired | Redirect to login |

## Performance

| Metric | Target |
|--------|--------|
| Initial load | < 1s |
| KB creation | < 5s for 10 docs |
| Query response | < 2s |
| Chunk limit | 10 files max |

## Future Enhancements

1. **Real-time Streaming** - Stream responses as generated
2. **Document Preview** - Show source in context
3. **Export Conversations** - PDF/Word export
4. **Custom Prompts** - Role-specific question sets
5. **Multi-Language** - Support for other languages
6. **Voice Input** - Speech-to-text queries
7. **Feedback Loop** - Improve retrieval over time

## Security

| Feature | Implementation |
|---------|----------------|
| Auth Required | JWT token validation |
| Study Isolation | Per-study document access |
| No Data Leakage | Strict context grounding |
| Audit Logging | All queries logged |

---

*Powered by RAG Technology - Retrieval-Augmented Generation*
*Part of ADAM AI Clinical Programming Platform*
