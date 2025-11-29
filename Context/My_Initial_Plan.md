# Enter Study Details & Study Chatbot – Implementation Plan

## 1. Goals & Scope

- Build an “Enter Study Details” module that becomes the **single source of truth** for all study-specific documents and metadata (study name, description, tags, standards versions, ADaM datasets to be generated, etc.).
- Ensure **all other app modules** (Pre‑P21/CT validator, ADRG/SDRG Templates, eCTD Packaging, ADaM Pair Programming, etc.) can **look up and behave based on the selected study** (`study_id`) without breaking existing functionality.
- Implement a **study-centric chatbot** that answers **only from documents uploaded for that study**, using retrieval‑augmented LLM calls, with strong guardrails to avoid hallucinations.
- Keep the UX **simple, professional, and domain‑friendly**, with easy navigation between studies and clear visibility of what is configured for each study.
- Make the solution **extensible** (new metadata fields, new document types, new workflows) and consistent with existing FastAPI + React + LLM architecture described in `Context/ProjectArchitecture`.

---

## 2. High-Level Architecture

- **Frontend**
  - React 18 + TypeScript + Ant Design (per TECH_STACK) for UI.
  - New **“Enter Study Details” page** plus shared **Study Switcher** component used across pages.
  - Use **Zustand** (or the existing state store) for global `currentStudyId` and cached study summaries.
  - Upload controls for study documents (drag & drop) and rich form for study metadata.
  - Study chatbot UI panel (either in this page or a dedicated tab) that shows chat history and document citations.

- **Backend (FastAPI)**
  - New `Study` domain module with:
    - REST endpoints under `/studies` (list, create, update, get by id, delete/soft-delete).
    - Sub-resources under `/studies/{study_id}/documents`, `/studies/{study_id}/config`, `/studies/{study_id}/chat`.
  - Use SQLAlchemy models and Alembic migrations (as per `0_mylistofreqmts.md` checklist) to store:
    - Core study metadata.
    - Study documents metadata (file path, type, version, tags).
    - Selected ADaM datasets and standards versions.
    - Study chatbot sessions and Q&A logs (for audit trail).
    - Optional document embeddings/index records for retrieval.
  - File storage via S3 or equivalent (per TECH_STACK) with pre-signed URLs or local dev folder.
  - LLM integration via Gemini (or configured LLM provider) for the **study chatbot**, with retrieval‑augmented prompting using study documents only.

- **Cross‑Module Integration**
  - Every major feature page that needs study context (Pre‑P21 checks, CT validator, ADRG/SDRG templates, eCTD packaging, ADaM program generator, TLF generator, etc.) will:
    - Require a `study_id` from the frontend (via dropdown / global study selector).
    - Use new `Study` APIs to retrieve relevant configuration and documents.
  - Existing endpoints that already accept `study_id` (e.g. `TLFAnalysisRequest.study_id`) remain backward‑compatible:
    - If `study_id` is provided, use the new study module for context.
    - If not, fall back to existing behavior.

---

## 3. Data Model & Database Design

### 3.1 Core Entities

Define new SQLAlchemy models (with corresponding Pydantic schemas) and migrations:

- `Study`
  - `id` (UUID / string, primary key; user‑visible `studyId`).
  - `name` (string, required).
  - `description` (text, optional).
  - `sponsor` / `project_code` (optional, for future use).
  - `tags` (array or JSONB; e.g. ["oncology", "phase3"]).
  - `sdtm_version` (string, e.g. "SDTMIG 3.4").
  - `adam_version` (string, e.g. "ADaMIG 1.3").
  - `define_xml_version` (optional, string).
  - `ig_version` (optional; generic field for implementation guide).
  - `is_active` (bool; can be used for quick filtering).
  - `created_at`, `updated_at`.
  - `created_by_user_id`, `last_modified_by_user_id` (for audit).
  - `extra_metadata` (JSONB) to support extensible future fields without schema changes.

- `StudyDatasetSelection`
  - `id`, `study_id` (FK -> `Study`).
  - `dataset_name` (e.g. "ADSL", "ADAE", "ADLB", etc.).
  - `language` (enum: "SAS", "R", "Both"), for pairing with generative engine.
  - `is_active` (bool).
  - `priority` / `ordering` (optional).
  - Constraint to ensure `(study_id, dataset_name)` uniqueness.

- `StudyDocument`
  - `id`, `study_id` (FK -> `Study`).
  - `document_type` (enum / string):
    - e.g. `SPECIFICATION`, `SAP`, `ADAM_SPEC`, `SDTM_MAPPING`, `PROGRAMMING_GUIDE`, `CT_LIST`, `ADRG_TEMPLATE`, `SDRG_TEMPLATE`, `ECTD_CONFIG`, `OTHER`.
  - `file_name`, `original_file_name`.
  - `storage_path` or `storage_url` (e.g. S3 key or local path).
  - `mime_type`, `size_bytes`.
  - `version_label` (e.g. "v1.0", "2025‑11‑01").
  - `uploaded_by_user_id`, `uploaded_at`.
  - `is_active` (for soft delete / versioning).
  - `tags` (JSONB; e.g. `{"visit": "week12"}`).

- `StudyChatMessage` / `StudyChatSession`
  - `StudyChatSession`
    - `id`, `study_id` (FK).
    - `created_by_user_id`, `created_at`.
    - `title` (optional) – e.g. “ADSL derivations discussion”.
  - `StudyChatMessage`
    - `id`, `session_id` (FK -> `StudyChatSession`).
    - `role` (enum: `user`, `assistant`, `system`).
    - `content` (text).
    - `timestamp`.
    - `source_document_ids` (JSONB: list of `StudyDocument.id` used; for traceability and Part 11 alignment).

- `DocumentEmbedding` (if using vector search)
  - `id`, `study_document_id` (FK -> `StudyDocument`).
  - `chunk_id` / `chunk_index`.
  - `embedding_vector` (vector field in DB or external vector store key).
  - `chunk_text` (text, normalized).
  - `metadata` (JSONB: page number, section, etc.).

### 3.2 Migration Strategy

- Create Alembic migrations that:
  - Add the new tables with proper foreign keys and indexes (e.g. `idx_study_name`, `idx_study_doc_type`, `idx_study_dataset_name`).
  - Use **non‑breaking** schema changes so existing features continue to work.
  - Optionally backfill `Study` records for existing data, if any current features already use `study_id` in other tables.
- Ensure migrations are **idempotent** and tested against:
  - Fresh database (clean install).
  - Existing dev/prod database snapshots (no downtime).

---

## 4. Backend API Design (FastAPI)

### 4.1 Study CRUD & Lookup

Create a new `APIRouter` (e.g. `backend/app/api/v1/endpoints/studies.py`) and corresponding service layer `app/modules/studies/service.py` following the existing pattern used in `tlf_generator.py`:

- `GET /studies`
  - Query parameters: `search`, `tag`, `is_active`, pagination (`page`, `page_size`).
  - Returns: list of study summaries (`id`, `name`, `tags`, key versions, dataset count).

- `POST /studies`
  - Body: `CreateStudyRequest` model with all key fields except `id`, `created_at`.
  - Generates `study_id` (UUID) and stores metadata.
  - Returns: full `StudyDetail` including dataset selections and documents counts.

- `GET /studies/{study_id}`
  - Returns full study details, including:
    - Metadata.
    - `selected_datasets` list.
    - High‑level document summary by type (counts, latest version).

- `PUT /studies/{study_id}`
  - Body: `UpdateStudyRequest` (partial updates allowed).
  - Supports adding/removing tags, updating standard versions, etc.

- `DELETE /studies/{study_id}`
  - Implement as **soft delete** (set `is_active=False`) to avoid breaking references.
  - Check for dependencies (existing jobs, code generations, etc.) and refuse hard delete if in use.

### 4.2 Study Dataset Selection

- `PUT /studies/{study_id}/datasets`
  - Body: `StudyDatasetSelectionRequest` containing:
    - `adam_datasets` as a list of dataset names (multi‑select).
    - Optional `language` preferences.
  - Implementation:
    - Replace or upsert records in `StudyDatasetSelection`.
    - Validate dataset names against ADaM rules/known list (e.g., from `Context\ADAMRules`).

- `GET /studies/{study_id}/datasets`
  - Returns the current selection with metadata (e.g. last updated, by whom).
  - Used by the **pair programming page** to populate its dataset dropdown.

### 4.3 Document Upload & Management

- `POST /studies/{study_id}/documents`
  - Multipart form:
    - `file: UploadFile`.
    - `document_type` (enum).
    - Optional `version_label`, `tags` (JSON string), `description`.
  - Creates a `StudyDocument` record and stores the file in configured storage location:
    - Local dev: e.g. `Content/UserInputs/StudyDocuments/{study_id}/`.
    - Prod: S3 bucket prefix `studies/{study_id}/documents/`.
  - Triggers background processing:
    - Document text extraction for chatbot (PDF/Word/Excel parsing).
    - Embedding creation (if vector search used).

- `GET /studies/{study_id}/documents`
  - Filters: `document_type`, `active_only`, pagination.
  - Returns metadata and (optionally) signed URLs for download.

- `GET /studies/{study_id}/documents/{document_id}`
  - Returns detailed metadata and a pre‑signed URL for download.

- `DELETE /studies/{study_id}/documents/{document_id}`
  - Soft delete only (`is_active=False`).
  - Keep file in storage (for audit) but hide from normal workflows unless explicitly requested.

### 4.4 Study Chatbot Endpoint

Design the chatbot as a **pure study assistant**:

- `POST /studies/{study_id}/chat`
  - Body:
    - `session_id` (optional; if absent, create new session).
    - `question` (string).
    - `include_history` (bool).
  - Implementation steps:
    1. Validate `study_id` exists and user has access.
    2. Retrieve relevant document chunks from `DocumentEmbedding` / text index:
       - Filter strictly by `study_id`.
       - Use similarity search with top‑k results.
    3. Build an LLM prompt with:
       - System message: “You are a study assistant for ADaM programmers. Answer **only** from the provided study documents. If the answer is not present, say you don’t know.”
       - Context: selected document chunks with clear citations (document type, file name, section).
       - User question + optional conversation history (previous Q&A in this session).
    4. Call the LLM provider (Gemini or other) via a **backend service layer**, with:
       - Temperature tuned low to reduce hallucinations.
       - Max tokens limited.
    5. Save `StudyChatMessage` entries for both user and assistant:
       - Store `source_document_ids` for the assistant message.
    6. Return:
       - `answer`.
       - `session_id`.
       - `citations`: list of documents and chunk locations used.

- `GET /studies/{study_id}/chat/sessions`
  - List existing sessions for that study.

- `GET /studies/{study_id}/chat/sessions/{session_id}`
  - Retrieve chat history (for UI).

### 4.5 Integration Helpers for Other Modules

Implement a **StudyContextService** in backend (e.g. `app/modules/studies/context_service.py`) to keep other modules simple and avoid duplication:

- APIs:
  - `get_study_summary(study_id)` – basic metadata.
  - `get_study_documents(study_id, document_type)` – list of active docs of a given type.
  - `get_study_spec_documents(study_id, dataset_name)` – convenience for pairing with ADaM rules.
  - `get_study_dataset_selection(study_id)` – dataset selections for ADaM generator and pair‑programming UI.

Usage:

- **Pre‑P21 Structural Checks & CT Validator**
  - Use `get_study_documents(study_id, document_type="SPECIFICATION")` and CT‑related documents to drive validations.

- **ADRG/SDRG Templates**
  - Fetch template configurations and document locations scoped to `study_id`.

- **eCTD Packaging**
  - Read study‑specific documents and metadata (e.g., what datasets, which outputs) to build folder trees and manifests.

- **ADaM Program Generator & TLF Generator**
  - Use `study_id` to get the right specs and context for generating programs, ensuring consistent behavior across modules.

---

## 5. Frontend UX & UI Design

### 5.1 Navigation & Layout

- Add a main navigation entry: **“Study Setup” → “Enter Study Details”**.
- Use a **two‑column layout**:
  - Left: study list & active study selector.
  - Right: details for the selected study with tabs.

### 5.2 Study List & Selector

- Component: `StudySelector` (shared across app).
  - Dropdown/list view with:
    - Study name.
    - Short tags.
    - Key versions (SDTM/ADaM).
  - “Create New Study” button in the same component.
  - When user switches study:
    - Update global `currentStudyId` state (Zustand/Context).
    - Notify all subscribed pages (Pre‑P21, ADRG/SDRG, eCTD, pair programming, TLF generator) to refresh their study‑specific data.
  - Persist last‑selected study in local storage for auto‑restore on reload.

### 5.3 Enter Study Details Form

- Form sections (using Ant Design `Tabs` or `Steps`):
  1. **Basic Info**
     - Study Name (required).
     - Study ID (auto‑generated, read‑only, but copyable).
     - Description (text area).
     - Tags (tokenized multi‑select).
  2. **Standards & Versions**
     - SDTM version (dropdown from preconfigured list).
     - ADaM version.
     - Define‑XML version.
     - IG version or “Data Standards Package” reference.
  3. **Datasets to Generate**
     - Multi‑select dropdown for ADaM datasets (ADSL, ADAE, ADLB, etc.) — this feeds the pair‑programming page.
     - Optional toggles for language (SAS / R / both).
  4. **Study Documents**
     - Drag‑and‑drop area with:
       - Document type selector.
       - Version label.
       - Tags (optional).
     - Table view below:
       - Columns: Type, File Name, Version, Uploaded On, Uploaded By, Actions (download, mark inactive).
       - Filter by document type and search by filename.

- UX principles:
  - Auto-save or explicit **“Save”** button with clear success/failure states.
  - Prevent user from leaving with unsaved changes (confirmation dialog).
  - Display validation messages inline and use simple wording.

### 5.4 Study Chatbot UI

- Accessible as:
  - A tab within “Enter Study Details” (e.g. “Study Chatbot”), or
  - A side panel icon when a study is selected.

- UI elements:
  - Chat window with user and assistant messages.
  - Input box with:
    - Placeholder: “Ask any question based on the uploaded study documents…”
  - Metadata:
    - Chip badges for documents used in the last answer, clickable to open the document or highlight the relevant section (in future).
  - Clear indicator that answers are **based only on uploaded documents** and may say “I don’t know” if information is missing.

### 5.5 Global Integration with Other Pages

- Each major page (Pre‑P21, ADRG/SDRG, eCTD, ADaM Pair Programming, TLF generator, etc.):
  - Uses `StudySelector` at the top (or in header).
  - When `currentStudyId` changes:
    - Re‑fetches their study‑specific configuration via `/studies/{study_id}/config` or specialized endpoints.
    - Updates forms/dropdowns accordingly (e.g. dataset dropdown in pair programming page is filtered by `StudyDatasetSelection`).

---

## 6. Study Chatbot Architecture & Behavior

### 6.1 Document Ingestion Pipeline

- On document upload (or via a background ETL job):
  - Detect file type (PDF, DOCX, XLSX, TXT).
  - Extract text using suitable libraries (e.g. `pdfplumber`, `python-docx`, `openpyxl`) in a background task (Celery/Redis if already used).
  - Normalize text and split into chunks (e.g. 500–1000 tokens with overlap).
  - Generate embeddings using the configured model.
  - Store chunks and embeddings in:
    - DB vector field (if using Postgres + pgvector), or
    - External vector store (e.g. Redis, Pinecone, etc. – whichever is already in TECH_STACK or preferred).
  - Link each chunk back to `StudyDocument` and store metadata (page number, section heading).

### 6.2 Query Flow

For each `POST /studies/{study_id}/chat` request:

1. **Authorization & Validation**
   - Ensure the user is allowed to access the study.
   - Ensure documents exist; if not, respond that no documents are available.

2. **Retrieval**
   - Use the question and optional chat history to build a search query.
   - Retrieve top‑k chunks only from embeddings where `study_id` matches.
   - Optionally re‑rank retrieved chunks by relevance.

3. **Prompt Construction**
   - System prompt that enforces:
     - Domain role: ADaM/clinical programmer assistant.
     - Source limitation: “Use only the provided context snippets from study documents. If something is not present, say you do not know.”
     - No generic / sample answers.
   - Compose context section with citations:
     - `[Doc: ADAM_SPEC, File: ADSL_Spec_v1.0.docx, Page: 3] ...`

4. **LLM Call**
   - Use Gemini (or configured model) with:
     - Low temperature.
     - Reasonable token limits.
   - Log model, temperature, and request ID for audit and troubleshooting.

5. **Post‑processing**
   - Map which chunks were used to `StudyDocument` IDs.
   - Create `StudyChatMessage` records for question and answer.
   - Return answer with citations and `session_id`.

6. **Edge Cases**
   - No documents / no relevant chunks: return a polite “I don’t know based on available documents” response.
   - Very long questions: truncate or summarize input before retrieval.
   - Rate limiting per user/study to avoid abuse and cost spikes.

---

## 7. Integration with Existing Features

### 7.1 ADaM Pair Programming Page

- Add a **Study ID dropdown** (using `StudySelector`) at the top.
- Load ADaM dataset selection for the active study via `/studies/{study_id}/datasets`:
  - Use the selected datasets to drive the dataset dropdown when generating code.
  - Pre‑populate the chatbot context on that page with study‑specific details (via `StudyContextService`).
- Ensure existing workflows without study selection continue to work:
  - If `study_id` is not selected, fall back to existing dataset selection logic or prompt user to select a study.

### 7.2 Pre‑P21 Structural Checks & CT Validator

- Before running checks:
  - Require `study_id` and load:
    - Structural specification documents.
    - CT lists for that study.
  - Use these documents to:
    - Validate SDTM input files.
    - Provide study‑specific validation messages.

### 7.3 ADRG/SDRG Templates

- When generating templates:
  - Pull study metadata (name, sponsor, datasets, standard versions) from `Study`.
  - Insert this information into the DOCX templates.
  - Reference study documents (e.g., SAP, specs) as part of the artifacts list.

### 7.4 eCTD Packaging

- Use `study_id` to:
  - Determine which datasets, specs, and outputs should be included in the package.
  - Populate folder structure, manifests, and checksums using study documents.

### 7.5 TLF Generator and Other AI Modules

- For endpoints similar to `tlf_generator.py`:
  - If `study_id` is provided:
    - Enrich requests with study metadata and documents via `StudyContextService`.
    - Use study‑specific configs (e.g., ADaM version, dataset selection) to guide AI prompts.
  - If `study_id` is absent:
    - Preserve existing behavior.

---

## 8. Security, Compliance & Performance Considerations

- **Security**
  - Apply authentication and authorization checks on all `/studies/*` endpoints.
  - Ensure study documents do not leak across tenants/projects (if multi‑tenant).
  - Validate file types and sizes on upload; reject executables or dangerous formats.
  - Sanitize file names and paths; use server‑generated storage keys.

- **Compliance (21 CFR Part 11 alignment)**
  - Log all changes to study metadata and document uploads (who, what, when).
  - Store chat interactions as part of the audit trail for decision making.
  - Ensure documents are immutable once used for a regulatory deliverable (or record their versions explicitly).
  - Integrate with broader audit trail and e‑signature workflows later, as per `0_mylistofreqmts.md`.

- **Performance**
  - Index study tables on frequently queried fields (name, tags, `is_active`).
  - Use background workers for CPU/IO‑heavy operations (text extraction, embeddings).
  - Cache frequently accessed study summaries (e.g., in Redis).
  - Use pagination for document listings and chat history.

---

## 9. Testing & Quality Strategy

- **Unit Tests**
  - Models: `Study`, `StudyDatasetSelection`, `StudyDocument`, `StudyChatSession`, `StudyChatMessage`.
  - Services: Study creation/update, document association, dataset selection logic, retrieval functions.

- **Integration Tests (Backend)**
  - End‑to‑end flows:
    - Create study → upload documents → set dataset selection → query chatbot.
    - Switch study and verify isolation (documents and chatbot context do not mix).
  - Failure cases:
    - Upload invalid file type or oversized file.
    - Query chatbot with no documents.

- **Frontend Tests**
  - Component tests for `StudySelector`, main form, document upload component, and chatbot UI.
  - Basic Vitest setup for new components, aligned with the checklist in `0_mylistofreqmts.md`.

- **Regression / Non‑Regression**
  - Ensure existing modules still function when `study_id` is not used.
  - Add feature flag (env‑based) to enable/disable the new study module in production.

---

## 10. Implementation Phases

1. **Phase 1 – Data & Backend Foundations**
   - Design and finalize DB schema.
   - Implement SQLAlchemy models and Alembic migrations.
   - Implement core CRUD endpoints for `Study` and dataset selection.

2. **Phase 2 – Document Management**
   - Implement document upload, storage, and metadata endpoints.
   - Build background processing for text extraction and embedding creation.

3. **Phase 3 – Frontend Study Details Page**
   - Implement `StudySelector` and “Enter Study Details” UI.
   - Wire up calls to study and document APIs.

4. **Phase 4 – Study Chatbot**
   - Implement retrieval and LLM integration for `/studies/{study_id}/chat`.
   - Build chatbot UI and integrate with the study details page.

5. **Phase 5 – Cross‑Module Integration**
   - Integrate study selection into pair programming page, Pre‑P21 checks, ADRG/SDRG, eCTD, and TLF generator.
   - Use `StudyContextService` to retrieve study data in each module.

6. **Phase 6 – Hardening & QA**
   - Add tests (backend and frontend).
   - Do performance and UX refinements.
   - Validate that existing features remain unchanged when the feature flag is off.

---

## 11. Open Questions / Clarifications Needed

- Which **database engine** is used in production (PostgreSQL vs. others) and do we already have pgvector or another vector store available?
- Are there existing **user/tenant** concepts that should scope `study_id` (e.g., per client, per project)?
- Do study documents contain any **PHI/PII** that would require additional encryption or masking?
- Should the **study chatbot** be available only in the “Enter Study Details” page or also embedded on the pair programming and validation pages?
- What is the expected **maximum file size** and **number of documents** per study to plan for storage and performance?
- Are there any existing **Study**-related tables/models that must be reused instead of creating new ones (to avoid duplication)?

Once these clarifications are provided, the plan can be refined further and implementation tasks can be broken down into detailed tickets.

