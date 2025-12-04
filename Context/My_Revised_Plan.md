# Enter Study Details & Study Chatbot – Revised Implementation Plan

## Executive Summary

This revised plan addresses all requirements from `0_MyRequirement_planner.md`, integrates with existing architecture patterns from `TECH_STACK.md`, and provides comprehensive implementation details for building the "Enter Study Details" module as the **single source of truth** for study-specific data across the ADAM_AI application.

**Key Improvements Over Initial Plan:**
- ✅ Integration with existing `study_models.py` and `study_service.py`
- ✅ Detailed state management strategy using existing Zustand patterns
- ✅ Comprehensive error handling and edge case coverage
- ✅ Performance optimization strategies
- ✅ Security and compliance (21 CFR Part 11) considerations
- ✅ Migration strategy for existing data
- ✅ Testing strategy with specific coverage targets
- ✅ Risk mitigation and rollback procedures

---

## 1. Goals & Scope (Refined)

### Primary Goals
1. **Central Study Hub**: "Enter Study Details" page becomes the **single source of truth** for all study metadata and documents
2. **Study-Centric Architecture**: All modules (Pre-P21, CT Validator, ADRG/SDRG, eCTD, Pair Programming, TLF Generator) operate on `study_id` basis
3. **Document Management**: Secure upload, storage, and retrieval of study documents (specs, SDTMs, ADaMs, SAPs, etc.)
4. **Study Chatbot**: RAG-based assistant that answers **strictly** from uploaded study documents only
5. **Seamless Integration**: Zero breaking changes to existing functionality; backward compatible

### Success Criteria
- ✅ Users can create/switch studies without losing context
- ✅ All uploaded documents are accessible across all modules via `study_id`
- ✅ Chatbot provides accurate, document-based answers with citations
- ✅ Study switching updates all dependent pages automatically
- ✅ Extensible schema supports future field additions without migrations
- ✅ 21 CFR Part 11 compliant audit trails

---

## 2. Architecture Integration & Enhancements

### 2.1 Integration with Existing Codebase

**Leverage Existing Infrastructure:**
- ✅ **Study Models**: Extend `backend/app/models/study_models.py` (already exists)
- ✅ **Study Service**: Enhance `backend/app/services/study_service.py` (already exists)
- ✅ **Database**: Use existing Alembic migration `001_multi_study_architecture.py` as foundation
- ✅ **State Management**: Extend `frontend/src/store/projectStore.ts` with study context
- ✅ **API Patterns**: Follow existing FastAPI patterns from `tlf_generator.py`

**New Components to Build:**
- `backend/app/api/v1/endpoints/studies.py` - Study CRUD endpoints
- `backend/app/api/v1/endpoints/study_documents.py` - Document management
- `backend/app/api/v1/endpoints/study_chat.py` - Chatbot endpoint
- `backend/app/modules/studies/document_service.py` - Document processing
- `backend/app/modules/studies/embedding_service.py` - Vector embeddings
- `backend/app/modules/studies/rag_service.py` - Retrieval-augmented generation
- `frontend/src/components/StudySelector.tsx` - Global study switcher
- `frontend/src/components/EnterStudyDetailsPage.tsx` - Main study details page
- `frontend/src/components/StudyChatbotPanel.tsx` - Chatbot UI
- `frontend/src/store/studyStore.ts` - Study-specific state management

### 2.2 State Management Strategy

**Extend Existing Zustand Store Pattern:**

```typescript
// frontend/src/store/studyStore.ts
interface StudyStore {
  // Current study context
  currentStudyId: string | null;
  currentStudy: Study | null;
  
  // Study list cache
  studies: StudyListItem[];
  studiesLoading: boolean;
  
  // Study documents cache
  documents: Record<string, StudyDocument[]>; // keyed by study_id
  documentsLoading: Record<string, boolean>;
  
  // Chatbot state
  chatSessions: Record<string, ChatSession[]>; // keyed by study_id
  activeChatSession: string | null;
  
  // Actions
  setCurrentStudy: (studyId: string) => Promise<void>;
  loadStudies: () => Promise<void>;
  loadStudyDocuments: (studyId: string) => Promise<void>;
  createStudy: (data: CreateStudyRequest) => Promise<Study>;
  updateStudy: (studyId: string, data: UpdateStudyRequest) => Promise<Study>;
  uploadDocument: (studyId: string, file: File, metadata: DocumentMetadata) => Promise<StudyDocument>;
  sendChatMessage: (studyId: string, message: string, sessionId?: string) => Promise<ChatResponse>;
  
  // Computed
  getStudyDocuments: (studyId: string, type?: DocumentType) => StudyDocument[];
  getStudyConfig: (studyId: string) => StudyConfig | null;
}

// Integration with existing projectStore
// projectStore.ts will reference studyStore for study context
```

**Global Study Context Provider:**
- Wrap app with `StudyContextProvider` to broadcast study changes
- Use React Context + Zustand for reactive updates across components
- Persist `currentStudyId` in localStorage for session restoration

### 2.3 Backend Service Layer Architecture

**Follow Existing Module Pattern:**

```
backend/app/modules/studies/
├── __init__.py
├── models.py              # Domain models (extend study_models.py)
├── service.py             # Business logic (extend study_service.py)
├── document_service.py    # Document upload, storage, processing
├── embedding_service.py   # Vector embeddings generation
├── rag_service.py         # Retrieval-augmented generation
└── context_service.py     # Helper for other modules to get study context
```

**Integration Points:**
- `StudyContextService.get_study_summary(study_id)` - Used by all modules
- `StudyContextService.get_study_documents(study_id, type)` - Used by validators
- `StudyContextService.get_study_dataset_selection(study_id)` - Used by pair programming

---

## 3. Enhanced Data Model & Database Design

### 3.1 Extend Existing Study Schema

**Build on `backend/alembic/versions/001_multi_study_architecture.py`:**

```python
# Additional tables to add via new migration

# StudyDatasetSelection (already partially exists, enhance)
class StudyDatasetSelection(Base):
    __tablename__ = 'study_dataset_selections'
    
    id = Column(String(50), primary_key=True)
    study_id = Column(String(255), ForeignKey('studies.id'), nullable=False, index=True)
    dataset_name = Column(String(50), nullable=False)  # ADSL, ADAE, ADLB, etc.
    language = Column(String(10), nullable=False)  # R, SAS, Both
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('study_id', 'dataset_name', name='uq_study_dataset'),
        Index('idx_study_dataset_active', 'study_id', 'is_active'),
    )

# StudyDocument (new table)
class StudyDocument(Base):
    __tablename__ = 'study_documents'
    
    id = Column(String(50), primary_key=True)
    study_id = Column(String(255), ForeignKey('studies.id'), nullable=False, index=True)
    document_type = Column(String(50), nullable=False)  # SPECIFICATION, SAP, ADAM_SPEC, etc.
    file_name = Column(String(255), nullable=False)
    original_file_name = Column(String(255), nullable=False)
    storage_path = Column(String(500), nullable=False)  # S3 key or local path
    storage_url = Column(String(500))  # Pre-signed URL (if S3)
    mime_type = Column(String(100))
    size_bytes = Column(BigInteger)
    version_label = Column(String(50))
    tags = Column(JSONB)  # {"visit": "week12", "dataset": "ADSL"}
    uploaded_by = Column(String(255), ForeignKey('users.id'), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_active = Column(Boolean, default=True)
    processing_status = Column(String(50), default='pending')  # pending, processing, completed, failed
    extracted_text = Column(Text)  # For chatbot retrieval
    metadata = Column(JSONB)  # Page count, sections, etc.
    
    __table_args__ = (
        Index('idx_study_doc_type', 'study_id', 'document_type', 'is_active'),
        Index('idx_study_doc_active', 'study_id', 'is_active'),
    )

# DocumentEmbedding (for vector search)
class DocumentEmbedding(Base):
    __tablename__ = 'document_embeddings'
    
    id = Column(String(50), primary_key=True)
    study_document_id = Column(String(50), ForeignKey('study_documents.id'), nullable=False, index=True)
    chunk_id = Column(String(50), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    chunk_text = Column(Text, nullable=False)
    embedding_vector = Column(JSONB)  # Store as JSON array, or use pgvector if available
    metadata = Column(JSONB)  # page_number, section, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        Index('idx_embedding_doc', 'study_document_id', 'chunk_index'),
    )

# StudyChatSession
class StudyChatSession(Base):
    __tablename__ = 'study_chat_sessions'
    
    id = Column(String(50), primary_key=True)
    study_id = Column(String(255), ForeignKey('studies.id'), nullable=False, index=True)
    title = Column(String(255))
    created_by = Column(String(255), ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        Index('idx_chat_session_study', 'study_id', 'created_at'),
    )

# StudyChatMessage
class StudyChatMessage(Base):
    __tablename__ = 'study_chat_messages'
    
    id = Column(String(50), primary_key=True)
    session_id = Column(String(50), ForeignKey('study_chat_sessions.id'), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    source_document_ids = Column(JSONB)  # List of document IDs used for answer
    model_used = Column(String(100))  # gemini-2.5-flash, etc.
    tokens_used = Column(Integer)
    
    __table_args__ = (
        Index('idx_chat_msg_session', 'session_id', 'timestamp'),
    )
```

### 3.2 Migration Strategy

**Create New Migration: `002_study_documents_and_chat.py`**

```python
# Key considerations:
1. Non-breaking: All new tables, no modifications to existing
2. Backward compatible: Existing code continues to work
3. Idempotent: Safe to run multiple times
4. Data migration: Optional backfill for existing studies
```

**Migration Steps:**
1. Create new tables with proper foreign keys
2. Add indexes for performance
3. Set up constraints (unique, check)
4. Optional: Backfill existing study data if any
5. Verify no breaking changes to existing queries

---

## 4. Enhanced Backend API Design

### 4.1 Study CRUD Endpoints

**File: `backend/app/api/v1/endpoints/studies.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from app.models.study_models import Study, StudyCreate, StudyUpdate, StudyListItem
from app.services.study_service import StudyService
from app.dependencies import get_db, get_current_user

router = APIRouter(prefix="/studies", tags=["studies"])

@router.get("", response_model=List[StudyListItem])
async def list_studies(
    search: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    is_active: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    List studies with filtering and pagination
    - Supports search by name/protocol
    - Filter by tags
    - Pagination support
    """
    service = StudyService(db, current_user)
    return await service.list_studies(
        search=search,
        tag=tag,
        is_active=is_active,
        page=page,
        page_size=page_size
    )

@router.post("", response_model=Study, status_code=201)
async def create_study(
    study_data: StudyCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    Create a new study
    - Generates unique study_id
    - Sets up default configurations
    - Returns full study object
    """
    service = StudyService(db, current_user)
    return await service.create_study(study_data)

@router.get("/{study_id}", response_model=Study)
async def get_study(
    study_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    Get study details including:
    - Metadata
    - Dataset selections
    - Document counts by type
    - Recent activity
    """
    service = StudyService(db, current_user)
    study = await service.get_study(study_id)
    if not study:
        raise HTTPException(404, "Study not found")
    return study

@router.put("/{study_id}", response_model=Study)
async def update_study(
    study_id: str,
    study_data: StudyUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    Update study metadata (partial updates supported)
    - Validates user permissions
    - Logs changes for audit
    """
    service = StudyService(db, current_user)
    return await service.update_study(study_id, study_data)

@router.delete("/{study_id}", status_code=204)
async def delete_study(
    study_id: str,
    hard_delete: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    Soft delete study (default) or hard delete if no dependencies
    - Checks for active jobs, code generations
    - Refuses hard delete if study is in use
    """
    service = StudyService(db, current_user)
    await service.delete_study(study_id, hard_delete=hard_delete)
```

### 4.2 Study Dataset Selection Endpoints

```python
@router.put("/{study_id}/datasets", response_model=List[StudyDataset])
async def update_datasets(
    study_id: str,
    datasets: StudyDatasetSelectionRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    Update ADAM dataset selections for a study
    - Validates dataset names against ADaM rules
    - Supports multi-select (ADSL, ADAE, ADLB, etc.)
    - Language preferences (R, SAS, Both)
    """
    # Implementation: Replace/upsert StudyDatasetSelection records
    # Validate against known ADaM datasets from Context/ADAMRules

@router.get("/{study_id}/datasets", response_model=List[StudyDataset])
async def get_datasets(
    study_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    Get current dataset selections
    - Used by pair programming page to populate dropdown
    """
```

### 4.3 Document Management Endpoints

**File: `backend/app/api/v1/endpoints/study_documents.py`**

```python
@router.post("/{study_id}/documents", response_model=StudyDocument)
async def upload_document(
    study_id: str,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    version_label: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # JSON string
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    Upload study document
    - Validates file type and size
    - Stores in S3 or local storage
    - Creates StudyDocument record
    - Triggers background processing (text extraction, embeddings)
    """
    # Implementation:
    # 1. Validate file (type, size, name sanitization)
    # 2. Generate storage path: studies/{study_id}/documents/{document_type}/{filename}
    # 3. Upload to storage (S3 or local)
    # 4. Create StudyDocument record
    # 5. Queue background task for text extraction and embedding
    # 6. Return document metadata

@router.get("/{study_id}/documents", response_model=List[StudyDocument])
async def list_documents(
    study_id: str,
    document_type: Optional[str] = Query(None),
    active_only: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    List study documents with filtering
    - Filter by document type
    - Pagination support
    - Returns metadata + pre-signed URLs for download
    """

@router.get("/{study_id}/documents/{document_id}", response_model=StudyDocument)
async def get_document(
    study_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    Get document details and download URL
    - Returns pre-signed URL (S3) or direct path (local)
    - Includes processing status
    """

@router.delete("/{study_id}/documents/{document_id}", status_code=204)
async def delete_document(
    study_id: str,
    document_id: str,
    hard_delete: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    Soft delete document (default)
    - Sets is_active=False
    - Keeps file in storage for audit
    - Hard delete only if explicitly requested and no dependencies
    """
```

### 4.4 Study Chatbot Endpoint

**File: `backend/app/api/v1/endpoints/study_chat.py`**

```python
@router.post("/{study_id}/chat", response_model=ChatResponse)
async def chat(
    study_id: str,
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    Study chatbot endpoint with RAG
    - Retrieves relevant document chunks
    - Builds context-aware prompt
    - Calls LLM with strict guardrails
    - Returns answer with citations
    """
    # Implementation flow:
    # 1. Validate study_id and user access
    # 2. Check if documents exist for study
    # 3. Retrieve relevant chunks using RAG service
    # 4. Build prompt with system message enforcing document-only answers
    # 5. Call LLM (Gemini) with low temperature
    # 6. Save messages to database
    # 7. Return answer with citations

@router.get("/{study_id}/chat/sessions", response_model=List[ChatSession])
async def list_sessions(
    study_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """List chat sessions for a study"""

@router.get("/{study_id}/chat/sessions/{session_id}", response_model=ChatSessionDetail)
async def get_session(
    study_id: str,
    session_id: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Get chat session with full message history"""
```

### 4.5 RAG Service Implementation

**File: `backend/app/modules/studies/rag_service.py`**

```python
class RAGService:
    """
    Retrieval-Augmented Generation service for study chatbot
    """
    
    def __init__(self, db: Session, llm_service: LLMService):
        self.db = db
        self.llm_service = llm_service
        self.embedding_service = EmbeddingService()
    
    async def retrieve_relevant_chunks(
        self,
        study_id: str,
        question: str,
        top_k: int = 5
    ) -> List[DocumentChunk]:
        """
        Retrieve relevant document chunks for a question
        - Generates embedding for question
        - Searches document embeddings (vector similarity)
        - Filters strictly by study_id
        - Returns top-k most relevant chunks with metadata
        """
        # Implementation:
        # 1. Generate question embedding
        # 2. Query DocumentEmbedding table with vector similarity
        # 3. Filter by study_id (critical for isolation)
        # 4. Return chunks with document references
    
    async def generate_answer(
        self,
        study_id: str,
        question: str,
        context_chunks: List[DocumentChunk],
        chat_history: Optional[List[ChatMessage]] = None
    ) -> ChatResponse:
        """
        Generate answer using LLM with strict guardrails
        - System prompt enforces document-only answers
        - Includes citations in response
        - Low temperature to reduce hallucinations
        """
        # Build prompt:
        system_prompt = """
        You are a study assistant for ADaM programmers. 
        Answer questions STRICTLY based on the provided study documents.
        If the answer is not present in the documents, say "I don't know based on the available documents."
        Do not provide generic or sample answers.
        Always cite which document and section you used.
        """
        
        # Compose context with citations
        context = self._build_context_with_citations(context_chunks)
        
        # Call LLM
        response = await self.llm_service.generate(
            system_prompt=system_prompt,
            user_message=question,
            context=context,
            temperature=0.1,  # Low temperature
            max_tokens=1000
        )
        
        # Extract citations from chunks used
        citations = [chunk.document_reference for chunk in context_chunks]
        
        return ChatResponse(
            answer=response,
            citations=citations,
            source_document_ids=[chunk.document_id for chunk in context_chunks]
        )
```

---

## 5. Enhanced Frontend Implementation

### 5.1 Study Selector Component

**File: `frontend/src/components/StudySelector.tsx`**

```typescript
interface StudySelectorProps {
  value?: string; // currentStudyId
  onChange?: (studyId: string) => void;
  onStudyChange?: (study: Study) => void;
  showCreateButton?: boolean;
  compact?: boolean;
}

export const StudySelector: React.FC<StudySelectorProps> = ({
  value,
  onChange,
  onStudyChange,
  showCreateButton = true,
  compact = false
}) => {
  const { studies, currentStudyId, setCurrentStudy, loadStudies } = useStudyStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  // Features:
  // - Dropdown with search
  // - Study tags and versions visible
  // - "Create New Study" button
  // - Last selected study persisted in localStorage
  // - Broadcasts study change to all subscribed components
  
  useEffect(() => {
    if (value && value !== currentStudyId) {
      setCurrentStudy(value);
    }
  }, [value]);
  
  const handleStudyChange = async (studyId: string) => {
    await setCurrentStudy(studyId);
    onChange?.(studyId);
    // Broadcast to all pages
    window.dispatchEvent(new CustomEvent('study-changed', { detail: { studyId } }));
  };
  
  // Render dropdown with search, study list, create button
};
```

### 5.2 Enter Study Details Page

**File: `frontend/src/components/EnterStudyDetailsPage.tsx`**

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│  Header: Study Selector + Study Name                     │
├─────────────────────────────────────────────────────────┤
│  Tab Navigation:                                         │
│  [Basic Info] [Standards] [Datasets] [Documents] [Chat] │
├─────────────────────────────────────────────────────────┤
│  Tab Content (based on active tab)                       │
│                                                          │
│  Basic Info Tab:                                         │
│  - Study Name (required)                                 │
│  - Study ID (auto-generated, read-only, copyable)        │
│  - Protocol Number                                       │
│  - Sponsor                                               │
│  - Therapeutic Area                                      │
│  - Study Phase                                           │
│  - Description (textarea)                                │
│  - Tags (multi-select with autocomplete)                 │
│                                                          │
│  Standards Tab:                                          │
│  - SDTM Version (dropdown)                              │
│  - ADaM IG Version (dropdown)                          │
│  - MedDRA Version (dropdown)                            │
│  - Define-XML Version (optional)                         │
│                                                          │
│  Datasets Tab:                                           │
│  - Multi-select for ADAM datasets                        │
│  - Language preferences (R/SAS/Both)                    │
│  - Dataset priority/ordering                             │
│                                                          │
│  Documents Tab:                                          │
│  - Drag & drop upload area                               │
│  - Document type selector                                │
│  - Version label input                                   │
│  - Tags input                                            │
│  - Documents table with filters                          │
│  - Actions: Download, Delete, View                       │
│                                                          │
│  Chat Tab:                                               │
│  - Chat interface (see StudyChatbotPanel)                 │
└─────────────────────────────────────────────────────────┘
```

**Key Features:**
- Auto-save on field blur (debounced)
- Unsaved changes warning on navigation
- Real-time validation with inline errors
- Loading states for async operations
- Success/error notifications
- Responsive design (mobile-friendly)

### 5.3 Study Chatbot Panel

**File: `frontend/src/components/StudyChatbotPanel.tsx`**

```typescript
interface StudyChatbotPanelProps {
  studyId: string;
  compact?: boolean;
}

export const StudyChatbotPanel: React.FC<StudyChatbotPanelProps> = ({
  studyId,
  compact = false
}) => {
  const { sendChatMessage, chatSessions, activeChatSession } = useStudyStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Features:
  // - Chat message list with user/assistant distinction
  // - Input box with send button
  // - Citation badges showing source documents
  // - "I don't know" indicator when no relevant docs found
  // - Session management (new session, load previous)
  // - Clear indication that answers are document-based only
  
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    setIsLoading(true);
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    
    try {
      const response = await sendChatMessage(studyId, input, activeChatSession);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.answer,
        citations: response.citations
      }]);
      setInput('');
    } catch (error) {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render chat UI
};
```

### 5.4 Global Study Context Integration

**File: `frontend/src/contexts/StudyContext.tsx`**

```typescript
// React Context to broadcast study changes
export const StudyContext = createContext<{
  currentStudyId: string | null;
  currentStudy: Study | null;
  setCurrentStudy: (studyId: string) => Promise<void>;
}>({
  currentStudyId: null,
  currentStudy: null,
  setCurrentStudy: async () => {}
});

// Provider component wraps app
export const StudyContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const studyStore = useStudyStore();
  
  useEffect(() => {
    // Listen for study changes and update all subscribed components
    const handleStudyChange = (event: CustomEvent) => {
      const { studyId } = event.detail;
      // Update Zustand store
      // Trigger re-renders in subscribed components
    };
    
    window.addEventListener('study-changed', handleStudyChange as EventListener);
    return () => window.removeEventListener('study-changed', handleStudyChange as EventListener);
  }, []);
  
  return (
    <StudyContext.Provider value={{
      currentStudyId: studyStore.currentStudyId,
      currentStudy: studyStore.currentStudy,
      setCurrentStudy: studyStore.setCurrentStudy
    }}>
      {children}
    </StudyContext.Provider>
  );
};
```

---

## 6. Integration with Existing Modules

### 6.1 Pair Programming Page Integration

**Modifications to `VariablesAnalysisTab.tsx`:**

```typescript
// Add StudySelector at top
<StudySelector 
  value={currentStudyId}
  onChange={handleStudyChange}
/>

// Load datasets from study
useEffect(() => {
  if (currentStudyId) {
    const studyConfig = studyStore.getStudyConfig(currentStudyId);
    if (studyConfig?.datasets) {
      // Update dataset dropdown with study selections
      setAvailableDatasets(studyConfig.datasets);
    }
  }
}, [currentStudyId]);

// Use study documents for context
const studyDocuments = studyStore.getStudyDocuments(currentStudyId, 'SPECIFICATION');
```

### 6.2 Pre-P21 & CT Validator Integration

```typescript
// Require study selection
if (!currentStudyId) {
  return <Alert message="Please select a study first" />;
}

// Load study documents
const specifications = studyStore.getStudyDocuments(currentStudyId, 'SPECIFICATION');
const ctLists = studyStore.getStudyDocuments(currentStudyId, 'CT_LIST');

// Use in validation
```

### 6.3 ADRG/SDRG Templates Integration

```typescript
// Fetch study metadata
const study = studyStore.currentStudy;
const studyConfig = studyStore.getStudyConfig(currentStudyId);

// Populate template with study data
const templateData = {
  studyName: study.name,
  protocolNumber: study.protocolNumber,
  sponsor: study.sponsor,
  datasets: studyConfig.datasets,
  standards: {
    sdtm: study.sdtmVersion,
    adam: study.adamIgVersion
  }
};
```

### 6.4 eCTD Packaging Integration

```typescript
// Use study documents and metadata
const studyDocuments = studyStore.getStudyDocuments(currentStudyId);
const studyConfig = studyStore.getStudyConfig(currentStudyId);

// Build package structure based on study
```

### 6.5 TLF Generator Integration

**Modify `tlf_generator.py`:**

```python
# Accept study_id in request
class TLFAnalysisRequest(BaseModel):
    study_id: Optional[str] = None  # New field
    # ... existing fields

# Use study context if provided
if request.study_id:
    study_context = StudyContextService.get_study_summary(request.study_id)
    study_documents = StudyContextService.get_study_documents(
        request.study_id, 
        document_type="SPECIFICATION"
    )
    # Enrich prompt with study context
else:
    # Fall back to existing behavior
    pass
```

---

## 7. Document Processing Pipeline

### 7.1 Background Task for Document Processing

**File: `backend/app/modules/studies/document_service.py`**

```python
from celery import shared_task
import pdfplumber
from docx import Document
import openpyxl

@shared_task
def process_study_document(document_id: str):
    """
    Background task to process uploaded document
    - Extract text based on file type
    - Normalize and chunk text
    - Generate embeddings
    - Store in database
    """
    # 1. Load document from storage
    # 2. Detect file type (PDF, DOCX, XLSX, TXT)
    # 3. Extract text using appropriate library
    # 4. Normalize text (clean, remove special chars)
    # 5. Split into chunks (500-1000 tokens with overlap)
    # 6. Generate embeddings for each chunk
    # 7. Store chunks and embeddings in DocumentEmbedding table
    # 8. Update document processing_status to 'completed'
    
    document = db.query(StudyDocument).filter_by(id=document_id).first()
    
    # Extract text
    if document.mime_type == 'application/pdf':
        text = extract_pdf_text(document.storage_path)
    elif document.mime_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        text = extract_docx_text(document.storage_path)
    elif document.mime_type == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        text = extract_xlsx_text(document.storage_path)
    else:
        text = extract_text_generic(document.storage_path)
    
    # Update document with extracted text
    document.extracted_text = text
    document.processing_status = 'processing'
    db.commit()
    
    # Chunk and embed
    chunks = chunk_text(text, chunk_size=500, overlap=50)
    embeddings = generate_embeddings(chunks)
    
    # Store embeddings
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        doc_embedding = DocumentEmbedding(
            study_document_id=document_id,
            chunk_id=f"{document_id}_chunk_{i}",
            chunk_index=i,
            chunk_text=chunk,
            embedding_vector=embedding,
            metadata={"page": i // 10, "section": "unknown"}
        )
        db.add(doc_embedding)
    
    document.processing_status = 'completed'
    db.commit()
```

### 7.2 Embedding Generation

**File: `backend/app/modules/studies/embedding_service.py`**

```python
class EmbeddingService:
    """
    Generate embeddings for document chunks
    Options:
    1. Use OpenAI embeddings API
    2. Use sentence-transformers (local)
    3. Use Gemini embeddings (if available)
    """
    
    def __init__(self):
        # Choose embedding model based on config
        self.model = self._load_embedding_model()
    
    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding vector for text"""
        # Implementation based on chosen model
        pass
    
    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Batch generate embeddings for efficiency"""
        pass
```

---

## 8. Security, Compliance & Performance

### 8.1 Security Enhancements

**Authentication & Authorization:**
- All endpoints require authentication (JWT or session-based)
- Study access control: Users can only access studies they created or have been shared with
- Document access: Validate study ownership before serving files
- File upload validation:
  - Whitelist file types (PDF, DOCX, XLSX, TXT only)
  - Max file size: 50MB (configurable)
  - Virus scanning (optional, for production)
  - Sanitize file names to prevent path traversal

**Data Isolation:**
- Strict `study_id` filtering in all queries
- No cross-study data leakage
- Vector search scoped to study_id only

**Input Validation:**
- Pydantic models for all request/response schemas
- SQL injection prevention (use parameterized queries)
- XSS prevention (sanitize user inputs)

### 8.2 21 CFR Part 11 Compliance

**Audit Trail:**
- Log all study metadata changes (who, what, when, why)
- Log all document uploads/deletions
- Log all chatbot interactions (for decision-making audit)
- Immutable audit logs (append-only, no deletions)
- Timestamp all actions with timezone

**Data Integrity:**
- Checksums for uploaded documents
- Version control for documents
- Immutable document storage (once used in regulatory deliverable)

**User Actions:**
- Track `created_by`, `updated_by`, `deleted_by` for all entities
- Session management and timeout
- E-signature support (future enhancement)

### 8.3 Performance Optimization

**Database:**
- Indexes on frequently queried fields:
  - `studies.id`, `studies.name`, `studies.created_by`
  - `study_documents.study_id`, `study_documents.document_type`
  - `document_embeddings.study_document_id`
- Connection pooling
- Query optimization (avoid N+1 queries)

**Caching:**
- Cache study summaries in Redis (5-minute TTL)
- Cache document metadata (1-minute TTL)
- Cache frequently accessed study configs

**Background Processing:**
- Use Celery for document processing (async)
- Batch embedding generation
- Queue management for heavy operations

**Frontend:**
- Lazy load study documents (pagination)
- Virtual scrolling for long lists
- Debounce search inputs
- Optimistic UI updates

---

## 9. Testing Strategy

### 9.1 Backend Tests

**Unit Tests:**
```python
# test_study_service.py
- test_create_study()
- test_update_study()
- test_delete_study_soft()
- test_delete_study_hard_with_dependencies()
- test_list_studies_with_filters()
- test_get_study_not_found()

# test_document_service.py
- test_upload_document()
- test_upload_invalid_file_type()
- test_upload_oversized_file()
- test_list_documents_filtered()
- test_delete_document_soft()

# test_rag_service.py
- test_retrieve_relevant_chunks()
- test_generate_answer_with_context()
- test_generate_answer_no_documents()
- test_generate_answer_no_relevant_chunks()
- test_citation_extraction()
```

**Integration Tests:**
```python
# test_study_workflow.py
- test_create_study_upload_documents_chat_flow()
- test_switch_study_isolation()
- test_study_document_processing_pipeline()
- test_chatbot_with_multiple_documents()
```

**Coverage Target:** 80%+ for new code

### 9.2 Frontend Tests

**Component Tests (Vitest):**
```typescript
// StudySelector.test.tsx
- renders study dropdown
- filters studies by search term
- calls onChange when study selected
- shows create button when enabled

// EnterStudyDetailsPage.test.tsx
- renders all tabs
- validates required fields
- saves study data on blur
- shows unsaved changes warning
- handles document upload

// StudyChatbotPanel.test.tsx
- sends message and receives response
- displays citations correctly
- handles "I don't know" responses
- manages chat sessions
```

**E2E Tests (Playwright):**
- Create study → Upload document → Ask chatbot question
- Switch studies → Verify context isolation
- Upload document → Verify processing status

### 9.3 Regression Tests

- Ensure existing pair programming page works without study_id
- Ensure existing TLF generator works without study_id
- Verify backward compatibility for all modules

---

## 10. Implementation Phases (Detailed)

### Phase 1: Database & Backend Foundations (Week 1-2)

**Tasks:**
1. ✅ Review existing `study_models.py` and `study_service.py`
2. ✅ Create migration `002_study_documents_and_chat.py`
3. ✅ Extend `StudyService` with document and dataset methods
4. ✅ Implement `DocumentService` for upload/storage
5. ✅ Create API endpoints for study CRUD
6. ✅ Create API endpoints for document management
7. ✅ Unit tests for services

**Deliverables:**
- Database schema with migrations
- Backend API endpoints (studies, documents)
- Service layer with business logic
- Unit tests (80% coverage)

### Phase 2: Document Processing Pipeline (Week 2-3)

**Tasks:**
1. ✅ Implement text extraction (PDF, DOCX, XLSX)
2. ✅ Implement text chunking strategy
3. ✅ Implement embedding generation
4. ✅ Set up Celery tasks for background processing
5. ✅ Create `EmbeddingService`
6. ✅ Store embeddings in database
7. ✅ Integration tests for processing pipeline

**Deliverables:**
- Document processing service
- Embedding generation and storage
- Background task queue setup
- Processing status tracking

### Phase 3: Study Chatbot (Week 3-4)

**Tasks:**
1. ✅ Implement `RAGService` for retrieval
2. ✅ Implement vector similarity search
3. ✅ Build prompt engineering with guardrails
4. ✅ Integrate with LLM service (Gemini)
5. ✅ Implement citation extraction
6. ✅ Create chat API endpoints
7. ✅ Store chat sessions and messages
8. ✅ Tests for RAG and chatbot

**Deliverables:**
- RAG service with vector search
- Chatbot API endpoint
- Citation system
- Chat history storage

### Phase 4: Frontend Study Details Page (Week 4-5)

**Tasks:**
1. ✅ Create `StudyStore` (Zustand)
2. ✅ Create `StudySelector` component
3. ✅ Create `EnterStudyDetailsPage` with tabs
4. ✅ Implement document upload UI
5. ✅ Implement study chatbot UI panel
6. ✅ Add auto-save functionality
7. ✅ Add validation and error handling
8. ✅ Component tests

**Deliverables:**
- Complete Enter Study Details page
- Study selector component
- Document upload interface
- Chatbot UI panel

### Phase 5: Global Study Context Integration (Week 5-6)

**Tasks:**
1. ✅ Create `StudyContextProvider`
2. ✅ Integrate `StudySelector` in header/navigation
3. ✅ Update `VariablesAnalysisTab` to use study context
4. ✅ Update Pre-P21/CT Validator to use study documents
5. ✅ Update ADRG/SDRG to use study metadata
6. ✅ Update eCTD Packaging to use study documents
7. ✅ Update TLF Generator to accept study_id
8. ✅ Integration tests for cross-module functionality

**Deliverables:**
- Global study context system
- All modules integrated with study selection
- Backward compatibility maintained

### Phase 6: Hardening, QA & Documentation (Week 6-7)

**Tasks:**
1. ✅ Performance testing and optimization
2. ✅ Security audit
3. ✅ 21 CFR Part 11 compliance verification
4. ✅ End-to-end testing
5. ✅ User acceptance testing
6. ✅ Documentation (API docs, user guide)
7. ✅ Deployment preparation

**Deliverables:**
- Production-ready code
- Complete test coverage
- Documentation
- Deployment guide

---

## 11. Risk Mitigation & Edge Cases

### 11.1 Identified Risks

**Risk 1: Data Migration Issues**
- **Mitigation:** 
  - Test migrations on staging database first
  - Create rollback scripts
  - Backup database before migration
  - Feature flag to disable new study module if issues arise

**Risk 2: Performance with Large Documents**
- **Mitigation:**
  - Implement document size limits (50MB)
  - Use streaming for large file uploads
  - Background processing for embeddings
  - Pagination for document lists
  - Cache frequently accessed data

**Risk 3: Chatbot Hallucinations**
- **Mitigation:**
  - Strict system prompts
  - Low temperature (0.1)
  - Citation requirements
  - "I don't know" responses when no relevant docs
  - User education about document-based answers

**Risk 4: Breaking Existing Functionality**
- **Mitigation:**
  - Backward compatibility for all endpoints
  - Feature flag to enable/disable study module
  - Comprehensive regression tests
  - Gradual rollout (canary deployment)

**Risk 5: Vector Search Performance**
- **Mitigation:**
  - Use pgvector if PostgreSQL available
  - Alternative: Use external vector DB (Pinecone, Weaviate)
  - Index optimization
  - Limit search scope to study_id

### 11.2 Edge Cases Handled

1. **No documents uploaded** → Chatbot returns "No documents available"
2. **No relevant chunks found** → Chatbot returns "I don't know based on available documents"
3. **Study deletion with active jobs** → Prevent hard delete, show dependencies
4. **Document upload failure** → Retry mechanism, status tracking
5. **Embedding generation failure** → Fallback to keyword search
6. **Study switch during active operation** → Cancel/complete current operation, switch context
7. **Concurrent document uploads** → Queue management, status tracking
8. **Large number of studies** → Pagination, search, filtering
9. **Invalid study_id in URL** → 404 error, redirect to study list
10. **Network failure during save** → Retry logic, offline indicator

---

## 12. Clarification Questions

1. **Database Engine**: Is PostgreSQL with pgvector available, or should we use external vector store (Pinecone, Weaviate)?

2. **File Storage**: S3 in production or local filesystem? What's the storage path structure preference?

3. **User/Tenant Model**: Are there existing user/tenant concepts that should scope studies? Multi-tenant architecture?

4. **PHI/PII Concerns**: Do study documents contain PHI/PII requiring additional encryption or masking?

5. **Maximum Scale**: Expected maximum number of studies per user? Documents per study? File sizes?

6. **Existing Study Data**: Are there existing study-related tables/models that should be reused to avoid duplication?

7. **Chatbot Availability**: Should chatbot be available only in "Enter Study Details" page or also embedded in pair programming and validation pages?

8. **Embedding Model**: Preference for embedding model (OpenAI, sentence-transformers, Gemini embeddings)?

9. **Audit Requirements**: Level of 21 CFR Part 11 compliance needed initially? E-signature requirements?

10. **Feature Flag**: Should study module be behind a feature flag for gradual rollout?

---

## 13. Success Metrics

- ✅ Users can create and switch studies seamlessly
- ✅ All study documents accessible across modules
- ✅ Chatbot provides accurate, cited answers
- ✅ Zero breaking changes to existing functionality
- ✅ <2s response time for study switching
- ✅ <5s document upload processing start
- ✅ 80%+ test coverage for new code
- ✅ Zero security vulnerabilities
- ✅ 21 CFR Part 11 audit trail complete

---

## 14. Next Steps

1. **Review & Approve Plan** - Stakeholder review of this revised plan
2. **Answer Clarification Questions** - Address open questions above
3. **Set Up Development Environment** - Database, Redis, S3/local storage
4. **Create Project Board** - Break down into tickets (Jira/GitHub Issues)
5. **Kickoff Phase 1** - Begin database and backend foundations

---

**Document Version:** 2.0  
**Last Updated:** November 25, 2025  
**Status:** Ready for Implementation  
**Estimated Timeline:** 6-7 weeks for full implementation



