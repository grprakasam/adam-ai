# TLF Generator - System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE (Frontend)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │
┌───────────────────────────────────▼─────────────────────────────────────────┐
│                         LANDING PAGE                                         │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  TLF Generator Card (New Feature)                                  │    │
│  │  - Icon: FileTextOutlined                                          │    │
│  │  - Status: Live                                                    │    │
│  │  - Action: Launch                                                  │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        │ Navigate to /tlf-generator
                                        │
┌───────────────────────────────────────▼─────────────────────────────────────┐
│                    WORKSPACE (RightPanel)                                    │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  TLF Generator Tab                                                 │    │
│  │  ┌──────────────────────────────────────────────────────────────┐ │    │
│  │  │  STEP 1: SELECT TYPE                                         │ │    │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │ │    │
│  │  │  │  Table   │  │ Listing  │  │  Figure  │                  │ │    │
│  │  │  │  Card    │  │   Card   │  │   Card   │                  │ │    │
│  │  │  └──────────┘  └──────────┘  └──────────┘                  │ │    │
│  │  └──────────────────────────────────────────────────────────────┘ │    │
│  │  ┌──────────────────────────────────────────────────────────────┐ │    │
│  │  │  STEP 2: UPLOAD & DETAILS                                   │ │    │
│  │  │  - Study ID                                                 │ │    │
│  │  │  - Dataset Name                                             │ │    │
│  │  │  - Output Name                                              │ │    │
│  │  │  - Description                                              │ │    │
│  │  │  - File Upload (PDF, Word, Excel, Images)                  │ │    │
│  │  │  - Additional Context                                       │ │    │
│  │  └──────────────────────────────────────────────────────────────┘ │    │
│  │  ┌──────────────────────────────────────────────────────────────┐ │    │
│  │  │  STEP 3: REVIEW UNDERSTANDING                               │ │    │
│  │  │  - AI Understanding Display                                 │ │    │
│  │  │  - Confidence Score                                         │ │    │
│  │  │  - Structure Details                                        │ │    │
│  │  │  - Suggestions & Clarifications                             │ │    │
│  │  │  - Approve / Re-upload Actions                              │ │    │
│  │  └──────────────────────────────────────────────────────────────┘ │    │
│  │  ┌──────────────────────────────────────────────────────────────┐ │    │
│  │  │  STEP 4: GENERATED OUTPUT                                   │ │    │
│  │  │  - Display Generated TLF                                    │ │    │
│  │  │  - Citations                                                │ │    │
│  │  │  - Download / Edit Options                                  │ │    │
│  │  │  - Create Another TLF                                       │ │    │
│  │  └──────────────────────────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        │ API Calls
                                        │
┌───────────────────────────────────────▼─────────────────────────────────────┐
│                         API LAYER (FastAPI)                                  │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  /api/v1/tlf-generator                                             │    │
│  │  ├─ POST /analyze        - Analyze mockshell document             │    │
│  │  ├─ POST /approve        - Approve/modify understanding            │    │
│  │  ├─ POST /generate       - Generate final TLF                      │    │
│  │  ├─ GET  /session/{id}   - Get session status                     │    │
│  │  ├─ DELETE /session/{id} - Delete session                         │    │
│  │  └─ GET  /examples       - Get example templates                  │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        │
┌───────────────────────────────────────▼─────────────────────────────────────┐
│                      SERVICE LAYER                                           │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  TLFGeneratorService                                               │    │
│  │  ├─ analyze_mockshell()           - Main analysis entry point     │    │
│  │  ├─ _analyze_document_with_ai()   - AI processing dispatcher      │    │
│  │  ├─ _analyze_visual_document()    - Vision-based analysis         │    │
│  │  ├─ _analyze_text_document()      - Text-based analysis           │    │
│  │  ├─ process_approval()            - Handle approval workflow      │    │
│  │  ├─ generate_tlf()                - Generate final output         │    │
│  │  ├─ _generate_tlf_output()        - AI generation logic           │    │
│  │  ├─ get_session()                 - Retrieve session              │    │
│  │  └─ delete_session()              - Clean up session              │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Session Storage (In-Memory / Redis / DB)                         │    │
│  │  - session_id (UUID)                                               │    │
│  │  - created_at                                                      │    │
│  │  - tlf_type                                                        │    │
│  │  - file_content (base64)                                           │    │
│  │  - metadata                                                        │    │
│  │  - understanding                                                   │    │
│  │  - status (analyzing/awaiting_approval/approved/completed)        │    │
│  │  - confidence_score                                                │    │
│  │  - generated_output                                                │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────┬─────────────────────────────────────┘
                                        │
                                        │
┌───────────────────────────────────────▼─────────────────────────────────────┐
│                    LLM INTEGRATION SERVICE                                   │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Multi-Provider LLM Service                                        │    │
│  │  ├─ OpenAI (GPT-4, GPT-3.5)                                        │    │
│  │  ├─ Anthropic (Claude)                                             │    │
│  │  ├─ Google (Gemini)                                                │    │
│  │  ├─ Groq (Mixtral, Llama)                                          │    │
│  │  └─ OpenRouter (Multiple models)                                   │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Features:                                                                   │
│  - Automatic fallback between providers                                     │
│  - Rate limiting with token bucket algorithm                                │
│  - Retry logic with exponential backoff                                     │
│  - Structured JSON response parsing                                         │
│  - Temperature and token limit configuration                                │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW                                          │
└──────────────────────────────────────────────────────────────────────────────┘

Upload Flow:
───────────
User → Select Type → Fill Form → Upload File 
  → API /analyze → Service analyze_mockshell() 
  → AI Analysis → Parse Response → Store Session 
  → Return Understanding → Display to User

Approval Flow:
─────────────
User Reviews → Approve/Modify → API /approve 
  → Service process_approval() → Update Session 
  → Return Status → Update UI

Generation Flow:
───────────────
User Confirms → API /generate → Service generate_tlf() 
  → AI Generation → Format Output → Extract Citations 
  → Store in Session → Return Output → Display to User

┌──────────────────────────────────────────────────────────────────────────────┐
│                       COMPONENT HIERARCHY                                    │
└──────────────────────────────────────────────────────────────────────────────┘

App.tsx
  └─ LandingPage.tsx
      └─ TLF Generator Card (Launch Button)
  └─ RightPanel.tsx
      └─ WorkspaceNavigation
      └─ TLFGeneratorTab.tsx
          ├─ Step 1: Type Selection
          │   ├─ Table Card
          │   ├─ Listing Card
          │   └─ Figure Card
          ├─ Step 2: Upload Form
          │   ├─ Form Fields (Ant Design)
          │   └─ Upload Component
          ├─ Step 3: Understanding Review
          │   ├─ Confidence Score Alert
          │   ├─ Understanding Details Cards
          │   └─ Action Buttons
          └─ Step 4: Generated Output
              ├─ Output Display
              ├─ Citations Section
              └─ Action Buttons

┌──────────────────────────────────────────────────────────────────────────────┐
│                          KEY TECHNOLOGIES                                    │
└──────────────────────────────────────────────────────────────────────────────┘

Backend:
  - FastAPI: REST API framework
  - Pydantic: Data validation
  - Loguru: Logging
  - Python 3.9+: Core language
  - Uvicorn: ASGI server

Frontend:
  - React 18: UI framework
  - TypeScript: Type safety
  - Ant Design: UI components
  - CSS3: Custom styling
  - Vite: Build tool

AI/ML:
  - OpenAI API: GPT models
  - Anthropic API: Claude models
  - Google AI: Gemini models
  - Groq: Fast inference

Infrastructure:
  - In-Memory: Session storage (MVP)
  - Redis: Session caching (production)
  - PostgreSQL: Persistent storage (production)
  - Docker: Containerization

┌──────────────────────────────────────────────────────────────────────────────┐
│                        SECURITY & COMPLIANCE                                 │
└──────────────────────────────────────────────────────────────────────────────┘

Security Measures:
  ✓ File type validation
  ✓ File size limits
  ✓ Input sanitization
  ✓ UUID-based session IDs
  ✓ CORS configuration
  ✓ Rate limiting
  ✓ Error handling without data leakage

Compliance Features:
  ✓ Citation tracking
  ✓ Audit trail (session history)
  ✓ Source document preservation
  ✓ Confidence score transparency
  ✓ Human approval workflow
  ✓ CDISC ADAM standards adherence

┌──────────────────────────────────────────────────────────────────────────────┐
│                      PERFORMANCE CHARACTERISTICS                             │
└──────────────────────────────────────────────────────────────────────────────┘

Latency:
  - File Upload: < 1 second (typical)
  - AI Analysis: 2-10 seconds (depends on LLM)
  - Approval: < 500ms (session update)
  - Generation: 3-15 seconds (depends on complexity)

Throughput:
  - Concurrent Users: 100+ (with proper infrastructure)
  - Sessions/hour: 1000+ (limited by LLM rate limits)
  - File Size Limit: 10MB (configurable)

Scalability:
  - Horizontal: Add more API servers
  - Vertical: Increase LLM rate limits
  - Caching: Redis for session management
  - Queue: For async processing (future)
```

## Architecture Highlights

### 1. **Layered Architecture**
- **Presentation Layer**: React components with TypeScript
- **API Layer**: FastAPI with RESTful endpoints
- **Service Layer**: Business logic and AI integration
- **Data Layer**: Session storage (scalable to Redis/DB)

### 2. **AI Integration Pattern**
- **Provider Abstraction**: Works with any LLM provider
- **Fallback Strategy**: Automatic provider switching
- **Rate Limiting**: Token bucket algorithm
- **Retry Logic**: Exponential backoff for transient errors

### 3. **Session Management**
- **Stateful Workflow**: Multi-step process with state persistence
- **UUID-based**: Secure session identification
- **Lifecycle Tracking**: Created → Analyzing → Awaiting → Approved → Completed
- **Cleanup**: Automatic or manual session deletion

### 4. **Document Processing**
- **Multi-Format**: PDF, Word, Excel, Images
- **Vision Ready**: Architecture supports vision AI
- **Text Extraction**: Handles text-based documents
- **Base64 Encoding**: Secure file storage in sessions

### 5. **User Experience**
- **Progressive Disclosure**: Step-by-step wizard
- **Visual Feedback**: Loading states, progress indicators
- **Error Recovery**: Re-upload capability
- **Transparency**: Confidence scores, AI explanations

### 6. **Extensibility**
- **New TLF Types**: Easy to add new output types
- **New Formats**: Simple to support additional file formats
- **New LLM Providers**: Plug-and-play provider integration
- **Custom Prompts**: Configurable AI prompts per type

---

**This architecture ensures scalability, maintainability, and excellent user experience while maintaining security and compliance standards.**


