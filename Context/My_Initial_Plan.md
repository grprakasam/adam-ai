
# ADAM AI – Initial Implementation Plan
## Pseudo-Code Column, Code Review & Finalization Page, and Study-Scoped Flow

> Role: System architect & planner (domain expert + ADaM programmer + UX designer)  
> Scope: Plan only – no code execution. Preserve all existing features and UX while adding:  
> 1) Pseudo-code snippet support on the Pair Programming page  
> 2) A new “Code Review & Finalization” page between pair programming and consolidated code  
> 3) Stronger study-scoped workflow so each project/study is clearly isolated

---

## 1. Current System Snapshot (What We’re Building On)

### 1.1 Frontend

- `VariablesAnalysisTab.tsx`
  - Handles spec upload, variable categorization, bulk AI generation, and approval progress.
  - Embeds `PairProgrammingArea` for per-variable cards.
  - Navigates to consolidated code and traceability tabs.
- `PairProgrammingArea.tsx`
  - Shows variable cards with fields (type, length, format, origin, derivation, rationale, code snippet, notes, acceptance).
  - Uses `pairProgramming.snippets` from `projectStore`.
  - Already optimized for UX per:
    - `VISUAL_TRANSFORMATION_SUMMARY.md`
    - `VISIBILITY_CONTROLS_QUICK_REFERENCE.md`
    - Z-index guidance files.
- `ConsolidatedCodeTab.tsx`
  - Enhanced consolidated-code UI per `futureplans.md` and `IMPLEMENTATION/*` docs.
  - Talks to `/api/v1/program-generation/consolidated`.
- `RightPanel.tsx`
  - Hosts workspace tabs: pair programming, consolidated code, validator, test with data, traceability, submission, R execution, etc.
  - Central place to add the new “Code Review & Finalization” tab.
- `projectStore.ts`
  - Holds:
    - `projectConfig` (includes `studyId`, `adamDataset`, standards, language).
    - `pairProgramming: { snippets, isGenerating }`.
    - `consolidatedCode: ConsolidatedCodeData | null`.
    - Submission readiness and validation state.

### 1.2 Backend

- `code_generation` endpoints:
  - `POST /api/v1/code-generation/generate-code-bulk`
  - `POST /api/v1/code-generation/generate-code-bulk-stream`
  - Return `CodeSnippetResponse` per variable; currently include code and rationale.
- `program_generation` module (per CLAUDE.md and IMPLEMENTATION docs):
  - `POST /api/v1/program-generation/consolidated` assembles consolidated ADaM program.
  - Uses ADAM compliance features (variable ordering, XPT output) from `ADAM_COMPLIANCE_IMPLEMENTATION.md`.
- R execution system:
  - Supports execution and validation of R code; important for downstream testing but not directly changed by this plan.

### 1.3 Domain & UX Rules (Context/*.md)

- `ProjectArchitecture.md` / `ProjectRequirements.md`:
  - Two main stages:
    1. Understand ADaM spec Excel (variables + derivation columns).
    2. Generate ADaM code using domain rules from `Context/ADAMRules`.
  - Must feel like a **domain-first ADaM pair programmer**, not a generic code generator.
- `ADAMRules/*`:
  - Variable naming, macro flow, ADSL derivation order, etc.
  - New features must respect naming/type rules (e.g., DT/DTM/FL suffixes).
- `criticism.md`:
  - App is not yet regulatory production-ready (missing full 21 CFR Part 11 stack).
  - We must not make that worse; review/export features should be designed so audit trails can be added later.

---

## 2. Feature Goals (High-Level)

### 2.1 Pseudo-Code Column (Pair Programming)

**Goal:** For every variable card, show a concise, human-readable pseudo-code explanation of the derivation logic, independent of R/SAS syntax.

Success criteria:
- Domain expert can validate logic without reading code.
- Developer can quickly understand and review derivations during testing.
- Pseudo-code is stable and cached like regular snippets; enabling fast reload.

### 2.2 “Code Review & Finalization” Page

**Goal:** Introduce a dedicated workspace page that:
- Displays the full consolidated ADaM program for the active study/dataset.
- Provides line-level comments and discussion.
- Summarizes variable-level decisions made in pair programming.
- Tracks a simple review status (not started → in review → changes requested → approved).
- Allows export of final code + comments into PDF/DOCX / plain script.

### 2.3 Study-Scoped Flow

**Goal:** Reinforce the concept that everything happens **within a selected study**:
- All pseudo-code, comments, review states, and consolidated programs are tied to:
  - `study_id` + `adamDataset` + `language` (+ `run_id` where applicable).
- Study selection in `StudySelector` / `ProjectsPage` drives all new API requests and UI context.

---

## 3. Pseudo-Code Column – Detailed Plan

### 3.1 UX & UI Design

**Design principles:**
- Integrate pseudo-code into existing card layout without clutter.
- Make it visible by default but hideable via existing visibility controls.
- Keep text short, structured, and clearly “logic-level”, not code.

**UI changes in `PairProgrammingArea.tsx`:**
- Add a new field to the field configuration:
  - `FieldId` union: add `'pseudo'`.
  - `FIELD_DEFINITIONS`:
    - `{ id: 'pseudo', label: 'Pseudo Code', alwaysVisible: false, requiresSnippet: true }`.
- Rendering:
  - In the body area where code and rationale are shown, add:
    - A pseudo-code section rendered only when:
      - The snippet has pseudo-code.
      - `visibleFields` includes `'pseudo'`.
  - Use mono-space font with `white-space: pre-wrap;` but **no** R/SAS syntax highlighting.

### 3.2 Frontend Data Model Changes

**Files:**
- `frontend/src/types/index.ts` (CodeSnippetResponse type)
- `frontend/src/store/projectStore.ts`
- `frontend/src/components/PairProgrammingArea.tsx`

Steps:
- Extend `CodeSnippetResponse` type to include optional pseudo-code fields:
  - `pseudo_code?: string;`
  - `pseudo_summary?: string;`
- Extend `VariableSnippet` in `projectStore`:
  - Add `pseudoCode?: string;` and `pseudoSummary?: string;` (mapped from API).
  - Update `setBulkCodeSnippets` so these fields are populated when present.
- Ensure state persistence via `persist` middleware continues working (pseudo fields are plain strings).

### 3.3 Backend Changes for Pseudo-Code

**Files:**
- `backend/app/models/input_models.py` (CodeSnippetResponse Pydantic model)
- `backend/app/modules/code_generator/service.py`
- `backend/app/modules/code_generator/prompt_builder.py`

Steps:
- Update `CodeSnippetResponse` model:
  - Add `pseudo_code: Optional[str] = None`.
  - Add `pseudo_summary: Optional[str] = None`.
- In `CodeGeneratorService`:
  - Ensure result objects carry `pseudo_code` and `pseudo_summary` alongside `code_snippet` and `coding_rationale`.
  - When using cache, store and retrieve pseudo fields under the existing cache key
    (based on variable, derivation, dataset, language, standards).
- Prompt design (`prompt_builder`):
  - Adjust prompts so each LLM call returns both code and pseudo-code in a structured way
    (e.g., JSON with keys `code_snippet`, `pseudo_code`, `pseudo_summary`).
  - Parse JSON safely; if parsing fails, fall back to:
    - Use code snippet only; set pseudo fields to `None`.
- Streaming bulk endpoint:
  - Ensure SSE events include pseudo fields and are serialized with `jsonable_encoder`.

Content guidelines & edge cases:
- Pseudo-code should be limited (~10–15 lines); describe domain steps, not language syntax.
- If pseudo-code is missing or too long, treat this as non-fatal:

---

## 4. “Code Review & Finalization” Page – Detailed Plan

### 4.1 Frontend Architecture

New component:
- `frontend/src/components/CodeReviewTab.tsx`
  - Receives context from `projectStore` (studyId, adamDataset, consolidatedCode, pairProgramming snippets).
  - Layout:
    - Header with study/dataset/language + review status badge.
    - Summary panel (variables approved vs modify, key notes).
    - Read-only code viewer (Monaco) for consolidated program.
    - Comments sidebar (list of comments grouped by status/line).
    - Actions (Mark in review, Request changes, Approve, Export).

Store additions in `projectStore.ts`:
- Types:
  - `CodeReviewComment` (id, studyId, dataset, language, runId?, lineNumber, text, status, timestamps).
  - `CodeReviewStatus` (`'not_started' | 'in_review' | 'changes_requested' | 'approved'`).
- State:
  - `codeReviewComments: CodeReviewComment[];`
  - `codeReviewStatus: CodeReviewStatus;`
  - `lastReviewedRunId: string | null;`
- Actions:
  - `setCodeReviewStatus(status: CodeReviewStatus): void;`
  - `addCodeReviewComment(data: Omit<CodeReviewComment, 'id' | 'createdAt'>): void;`
  - `updateCodeReviewComment(id, updates): void;`
  - `deleteCodeReviewComment(id): void;`
  - `loadCodeReviewSession(studyId, dataset, runId?): Promise<void>;` (calls backend).

Integration in `RightPanel.tsx`:
- Extend `WorkspaceTabKey` with `'review'`.
- Add tooltip entry for review tab.
- Insert new tab item (e.g., between `pair` and `consolidated`) with `children: <CodeReviewTab />`.
- Wire `VariablesAnalysisTab` to accept `onNavigateToReview` callback that sets active tab to `'review'`.

Comments UX in `CodeReviewTab`:
- Clicking gutter/line in Monaco opens “Add comment” modal (line number prefilled).
- Comments listed in sidebar with filters (all/open/resolved).
- Clicking a comment scrolls/highlights corresponding line in the code viewer.

### 4.2 Backend Architecture

New models (Pydantic + ORM):
- `CodeReviewSession`:
  - `id`, `study_id`, `dataset`, `language`, `run_id`, `status`, timestamps.
- `CodeReviewComment`:
  - `id`, `session_id`, `line_number`, `variable_name?`, `author?`, `role?`, `text`, `status`, timestamps.

Alembic migration:
- Add review tables with indexes on `(study_id, dataset, language, run_id)` and `(session_id, line_number)`.

New router: `backend/app/api/v1/endpoints/code_review.py`:
- `GET /api/v1/code-review/session` → get or lazily create session for study/dataset/language/run.
- `PATCH /api/v1/code-review/session/status` → update status.
- `GET /api/v1/code-review/comments` → list comments for session.
- `POST /api/v1/code-review/comments` → create comment.
- `PATCH /api/v1/code-review/comments/{id}` → update text/status.
- `DELETE /api/v1/code-review/comments/{id}` → soft-delete if required for audit.

Export endpoint:
- `POST /api/v1/code-review/export`
  - Request: `{ study_id, dataset, language, run_id, format, include_comments }`.
  - Behavior:
    - Load consolidated program for the given run.
    - Load review session and comments.
    - Generate document (text, DOCX, or PDF) with:
      - Study/dataset metadata.
      - Program listing with line numbers.
      - Comments table (line, text, author, status).
  - Response: streamed file download.

---

## 5. Study-Scoped Workflow Refinements

- Ensure all new APIs (pseudo-code, review, export) require `study_id` and, where relevant, `adamDataset` and `language`.
- In `projectStore`, treat `studyId` as the primary context key; when users switch study:
  - Clear or reload pair-programming, consolidated code, and review state for that study.
- In all new UI (PairProgrammingArea, CodeReviewTab, ConsolidatedCodeTab):
  - Display the active study and dataset prominently in headers.
  - Disable actions if no study is selected.

## 6. Implementation Order (Backend & Frontend)

**Backend (recommended order):**
1. Extend `CodeSnippetResponse` and `CodeGeneratorService` for pseudo-code.
2. Add review models and Alembic migration.
3. Implement `code_review` endpoints (session, comments, status).
4. Implement export endpoint.
5. Add logging and basic validation for new endpoints.

**Frontend (recommended order):**
1. Extend types and `projectStore` (`VariableSnippet`, review state).
2. Add pseudo-code field to `PairProgrammingArea` and test with existing bulk generation.
3. Implement `CodeReviewTab` with in-memory comments using mock data.
4. Wire `RightPanel` tab and `VariablesAnalysisTab` navigation.
5. Connect `CodeReviewTab` to backend review and export endpoints.

## 7. Risks & Mitigations (Summary)

- UX risk: cards may feel busy with pseudo-code.
  - Mitigate via field visibility toggles and concise pseudo-code content.
- Workflow risk: introducing a review tab could confuse users.
  - Mitigate with clear copy and non-blocking guidance (no hard gate to Consolidated tab initially).
- Technical risk: JSON parsing failures or LLM misformatting for pseudo-code.
  - Mitigate by reusing robust error handling patterns from `CODE_REVIEW_LLM_SERVICE.md` and falling back gracefully.
- Future compliance risk: comments and review decisions must be auditable.
  - Mitigate by designing DB schema and APIs to plug into future auth/audit layers cleanly.

## 8. Testing Strategy (High-Level)

- Backend:
  - Unit tests for pseudo-code fields in `CodeSnippetResponse` and service.
  - Tests for review endpoints (session CRUD, comments CRUD, export happy-path and failure cases).
- Frontend:
  - Component tests for `PairProgrammingArea` pseudo-code rendering and visibility.
  - Component tests for `CodeReviewTab` (comments, status updates, basic navigation).
  - End-to-end flow tests for: study selection → pair programming → consolidated code → review → export.

## 9. Open Questions / Clarifications Needed

1. Tab ordering vs. logical flow:
   - Do you want the visual tab order to strictly be Pair → Review → Consolidated, or is it acceptable to keep Consolidated where it is and rely on guidance?
2. Gating behavior:
   - Should consolidated program export / submission readiness be blocked until review status is `approved`, or should we only show warnings?
3. Export priorities:
   - Which export format is most critical initially: PDF, DOCX, or text script with comments?

## 10. Summary

This plan introduces:
- A pseudo-code column in Pair Programming cards for domain-friendly understanding of each derivation.
- A Code Review & Finalization tab that centralizes full-program review, comments, and approval workflow.
- Study-scoped behavior across new features so each project/study remains isolated and consistent with existing architecture.

Once you confirm the open questions above, the next step is to break this into concrete implementation tickets and start coding against this plan.
  - Missing → keep pseudo fields `None` and show “not generated” in UI.
  - Too long → truncate and add marker "(truncated)".
  - If present, show a short “Logic summary” line above the pseudo-code block.
