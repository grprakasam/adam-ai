# Initial Implementation Plan – Pseudo-Code & Code Review

> Plan only – no code execution.  
> Goal: Add pseudo-code support and a Code Review step between Pair Programming and Consolidated Code, without breaking existing behaviour.

---

## 1. Objectives and Scope

- Add a clear pseudo-code representation for each ADaM variable, derived from the derivation logic and spec.
- Make pseudo-code visible and easy to consume in the Pair Programming UI.
- Introduce a Code Review page between Pair Programming and Consolidated Code that:
  - Shows variable, derivation, pseudo-code, generated code, and user notes.
  - Allows approve / request-changes decisions and comments.
  - Integrates with existing code-review backend endpoints and store state.
- Keep the app study-centric (sessions bound to study and ADaM dataset).
- Preserve all existing features: spec upload, categorization, pair programming, consolidated code, submission checks, R execution.

Out of scope for this plan: running servers, applying migrations, or executing tests. Implementation teams will perform those steps.

---

## 2. Current State Snapshot (Relevant Pieces)

### 2.1 Study and project configuration

- `ProjectConfiguration` already includes `studyId`, `protocolNumber`, `sponsor`, `therapeuticArea`, `studyPhase`, standards versions, and `adamDataset`.
- The app is already designed to be study-centric; new features must always carry `(study_id, dataset, language)` on backend calls.

### 2.2 Pair Programming data model and UI

- Store (`frontend/src/store/projectStore.ts`):
  - `VariableSnippet` contains:
    - `variable`, `codeSnippet`, `rationale`, `userNotes`, `accepted`, `generatedAt`, `language`, optional `error`.
    - Optional pseudo-code fields already exist: `pseudoCode`, `pseudoSummary`, and related metadata flags.
  - `PairProgrammingState` holds `snippets` and `isGenerating` flags.
  - `setBulkCodeSnippets` maps `CodeSnippetResponse.pseudo_code` and `pseudo_summary` to `pseudoCode` and `pseudoSummary`.
- Types (`frontend/src/types/index.ts`):
  - `CodeSnippetResponse` already includes `pseudo_code` and `pseudo_summary`.
- UI (`frontend/src/components/PairProgrammingArea.tsx`):
  - Expanded variable cards already render:
    - Derivation logic.
    - Coding rationale.
    - A Pseudo-Code block using `snippet.pseudoCode` and `snippet.pseudoSummary`.
    - Code snippet with basic syntax highlighting.

Conclusion: pseudo-code is already part of the data model and is rendered in Pair Programming, but it is not yet treated as a first-class, review-oriented element and is not wired into a dedicated Code Review page.

### 2.3 Consolidated Code and review infrastructure

- Consolidated code (`frontend/src/components/ConsolidatedCodeTab.tsx`):
  - Builds `ConsolidatedVariable[]` from `pairProgramming.snippets`.
  - Uses all variables that have a `codeSnippet` and no `error`, regardless of `accepted` flag.
  - Calls backend with `ConsolidatedCodeRequest` including study, dataset, language, standards, and preferences.
  - `canGenerateConsolidated()` currently checks only that at least one variable has code.
- Code Review backend and store:
  - Types define `CodeReviewStatus`, `CodeReviewSession`, `CodeReviewComment`, and `ExportReviewRequest`.
  - Store has `codeReviewSession`, `codeReviewComments`, `codeReviewStatus`, `lastReviewedRunId`, and actions like `loadCodeReviewSession`, `updateReviewStatus`, `createComment`, `exportReviewPDF`, `clearCodeReview`.
  - API service (`frontend/src/services/api.ts`) exposes `/code-review/*` endpoints for sessions, comments, status, and export.
- Current `CodeReviewTab` component:
  - Implemented as an interactive R/SAS executor using `/code-execution/execute-snippet`.
  - Does not yet use code review APIs or store state.

Conclusion: backend and store support code review, but the Code Review tab UI does not yet implement the variable-centric review described in the requirements.

---

## 3. Requirements and Open Questions

### 3.1 Functional requirements (from requirements and architecture docs)

- Pseudo-code:
  - Generate a human-readable pseudo-code per variable based on derivation and spec context.
  - Show it clearly in Pair Programming and make it reusable in the Code Review page.
- Code Review page:
  - Appears between Pair Programming and Consolidated Code in the workspace flow.
  - Displays variable, derivation logic, pseudo-code, generated code, and user notes in a tabular or structured layout.
  - Lets users approve or request changes per variable, and record comments.
  - Integrates with `CodeReviewSession`, `CodeReviewStatus`, and `CodeReviewComment`, and supports PDF export.
- Study-centric behaviour:
  - All of the above must be scoped by selected `studyId`, `adamDataset`, and `programmingLanguage`.

### 3.2 Key clarifications needed

Implementation should confirm these points before coding:

1. Should consolidated code generation be:
   - Always allowed but clearly marked as "draft" until review is approved, or
   - Hard-gated so final generation only occurs when `CodeReviewStatus` is `APPROVED`?
2. Is the Code Review page intended to review:
   - Only variable-level information (derivation, pseudo, snippet), or
   - Also the final consolidated program text with line numbers via `run_id` and `line_number`?
3. For approval semantics:
   - Does "Approve" mean variable-level acceptance only, or approval of a specific consolidated run?
4. What should the existing interactive executor in `CodeReviewTab` become:
   - Moved into a dedicated "R Frontend" or "Test with Data" tab, or
   - Integrated as a secondary panel in the Code Review area?
5. For export:
   - Should the PDF include variables, pseudo-code, code, review statuses, and comments, and/or the consolidated program?

---

## 4. Architecture and Data Flow Design

### 4.1 Pseudo-code generation (backend and frontend)

- Backend:
  - Extend the existing snippet generation service (used to populate `CodeSnippetResponse`) so every successful call attempts to return:
    - `code_snippet`.
    - `coding_rationale`.
    - `pseudo_code` (stepwise logic, language-neutral).
    - `pseudo_summary` (one-line summary).
  - Reuse the shared LLM provider layer (retry, timeouts, validation, logging).
  - If pseudo-code fails, still return code and rationale; mark `has_pseudo_code = false` in metadata and include a human-readable warning.
- Frontend:
  - Keep using `CodeSnippetResponse` and `setBulkCodeSnippets` to populate `VariableSnippet.pseudoCode` and `pseudoSummary`.
  - Persist pseudo-code state with other snippet data via the existing persisted store.

### 4.2 Code Review session model

- Use existing entities:
  - `CodeReviewSession` for a review instance keyed by `(study_id, dataset, language, optional run_id)`.
  - `CodeReviewComment` for comments per session with optional `variable_name` and `line_number`.
- Consider (if not already present) a lightweight variable snapshot model:
  - Store, per session and variable:
    - Variable name and label.
    - Derivation logic.
    - Pseudo-code and summary.
    - Code snippet and rationale.
    - User notes and local review status (`pending`, `approved`, `changes_requested`).
  - Expose an endpoint such as `GET /code-review/session/{id}/variables` returning the snapshot list for the frontend table.

### 4.3 End-to-end flow overview

1. User selects study and dataset and uploads spec.
2. Spec is categorized; `VariablesAnalysisTab` and `PairProgrammingArea` show variables.
3. User runs Pair Programming to generate snippets; backend returns code, rationale, pseudo-code, and metadata; store is updated.
4. User navigates to Code Review:
   - Frontend calls `loadCodeReviewSession(studyId, dataset, language, runId?)`.
   - Backend creates or returns a `CodeReviewSession` and optionally variable snapshots.
5. Code Review tab shows the variable table, uses store and/or snapshots as data source, and allows:
   - Approval and request-changes of variables.
   - Comments on variables or lines (if consolidated text is in scope).
   - Status updates (`NOT_STARTED` to `IN_REVIEW`, `CHANGES_REQUESTED`, `APPROVED`).
6. Consolidated Code tab:
   - Still builds `approved_variables` from `pairProgramming.snippets`.
   - Becomes aware of overall `CodeReviewStatus` to show warnings or gate final actions.

---

## 5. Frontend Implementation Plan

### 5.1 Pair Programming improvements

- In `PairProgrammingArea`:
  - Treat Pseudo-Code as a first-class field:
    - Make it visible by default when `snippet.pseudoCode` exists (configurable).
    - Allow hiding/showing via field visibility controls.
  - Ensure labels and headings are clean and readable (no corrupted characters).
  - Style the pseudo-code block for readability:
    - Monospaced font, clear indentation, limited height with scroll.
  - Optionally expose:
    - "Regenerate code + pseudo-code" using the existing bulk generation flow.
    - A separate "Regenerate pseudo-code only" action if the backend supports it.

### 5.2 Code Review tab redesign

- Replace the current executor-focused `CodeReviewTab` with a variable-centric review UI:
  - On mount:
    - Read `studyId`, `adamDataset`, and `programmingLanguage` from `projectConfig`.
    - Call `loadCodeReviewSession` from the store.
  - Header:
    - Show study, dataset, language, and current `codeReviewStatus` as a badge.
    - Actions: set status to "In review", "Request changes", "Approve", and "Export PDF".
  - Main area:
    - Table or grid with columns:
      - Variable (name, label).
      - Derivation logic (preview + expandable full text).
      - Pseudo-code (summary + expandable code block).
      - Generated code (preview, with option to open a full view or side panel).
      - User notes from Pair Programming.
      - Review state (pending / approved / changes requested) with tags.
      - Row actions (approve, request changes, open in Pair Programming).
    - Optional right-side panel showing detailed view and comment thread for the selected variable.
  - Comments:
    - Use `codeReviewComments` and `createComment` / `updateReviewComment` from the store.
    - Allow adding comments at variable level (and at line level if consolidated code is also reviewed here).

### 5.3 Navigation and consolidated code awareness

- Keep `WorkspaceNavigation` and `RightPanel` ordering:
  - 1. Pair Programming.
  - 2. Code Review.
  - 3. Consolidated Code.
- From Code Review:
  - Provide an "Open in Pair Programming" action which dispatches a navigation event to the workspace.
  - Provide a "View Consolidated Code" button when a consolidated program exists.
- In `ConsolidatedCodeTab`:
  - Display a banner if `codeReviewStatus` is not `APPROVED` (content agreed with product owner).
  - Optionally:
    - Introduce a distinct finalisation action that requires `APPROVED` status.

---

## 6. Backend Implementation Plan

### 6.1 Pseudo-code generation

- Extend variable-level snippet generation service:
  - Input: spec row (variable name, label, type, length, format, derivation), study metadata, dataset type, and relevant ADaM rules.
  - Output: `CodeSnippetResponse` with code, rationale, pseudo-code, summary, and metadata.
- Implement an LLM prompt that:
  - Produces language-neutral, step-by-step pseudo-code.
  - References SDTM domains and variables by name.
  - Emphasises clarity for domain experts, and avoids R/SAS syntax.
- Apply existing LLM patterns:
  - Input validation.
  - Timeouts and retry logic.
  - Provider-specific error classification and logging.

### 6.2 Code Review session and variable snapshots

- Confirm or add a backend model to persist variable snapshots per `CodeReviewSession`.
- Implement endpoints (names indicative):
  - `POST /code-review/session` (already exists): ensure it links to study, dataset, language, and optionally `run_id`.
  - `GET /code-review/session/{id}/variables`: return snapshot list for UI.
  - Existing comment and status endpoints remain in use; add any validation needed (for example, prevent `APPROVED` if snapshots show pending or requested changes).
- Ensure all entities include `study_id`, `dataset`, and `language` where appropriate and are indexed to support multi-project deployment.

### 6.3 Database migration and operations

- If new snapshot tables or columns are needed:
  - Add Alembic migrations to create or alter tables.
  - Test migrations in a non-production environment.
- Implementation team will run the migration commands (as referenced in existing implementation guides) before deploying updated services.

---

## 7. Testing, Quality, and Edge Cases

### 7.1 Functional test scenarios

- Typical happy-path flows:
  - Study selection → spec upload → variable categorization → Pair Programming with pseudo-code → Code Review → Consolidated Code.
  - Generating code and pseudo-code in bulk and for individual variables.
  - Creating, updating, and resolving review comments; changing review statuses; exporting a PDF.
- Edge cases:
  - Variables without derivation logic.
  - LLM failures (no pseudo-code) while code snippet succeeds.
  - Large number of variables; ensure UI remains responsive.
  - Switching studies or datasets mid-session (state isolation).

### 7.2 Regression checks

- Verify the following remain intact:
  - Spec upload and parsing.
  - Variable categorization and workspace initialization.
  - Consolidated code generation and download.
  - Submission readiness dashboard (preflight, CT, P21, define, ADRG/SDRG, eCTD).
  - R execution and other utility tabs.

### 7.3 Non-functional requirements

- Performance:
  - Avoid unnecessary repeated LLM calls for the same variable and context; reuse cached results where feasible.
  - Paginate or virtualise long tables in Code Review.
- Reliability:
  - Graceful degradation when LLM or review APIs are unavailable; no hard crashes.
  - Good error messages for domain users (no stack traces).
- Security:
  - Ensure that prompts and logs do not include secrets or patient identifiers.
  - Respect any existing auth/role model when exposing review and approval actions.

---

## 8. Next Steps

- Confirm answers to the open questions in Section 3.2.
- Decide on behaviour for gating consolidated code by review status.
- Once clarified, implementation can follow the phases above:
  - Backend pseudo-code and review snapshot enhancements.
  - Frontend Pair Programming polish.
  - Code Review tab redesign and navigation integration.
  - Testing and regression validation.
