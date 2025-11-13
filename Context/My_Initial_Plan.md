# ADAM AI - Approval Progress & Code Generation Plan (Initial)

Plan created per `Context/0_MyRequirement_planner.md`, `Context/ProjectArchitecture/*`, all Context/ADAMRules docs, repository phase summaries, backend/frontend READMEs, Quick Reference, and external UX research (Nielsen Norman Group 2024 guidance on progress indicators plus Material Design 3 progress specs). Scope limited to current ADSL workflow with Google Gemini 2.5 Flash as the primary LLM.

## 1. Inputs & Constraints Reviewed
- Repository markdowns: BUGFIX_BACKEND_ENDPOINT, IMPLEMENTATION_PROGRESS/COMPLETE, LANDING_PAGE_LAYOUT, REFACTORING_PLAN, PHASE_* & PHASES_* reports, Context/{1a_Planner,1b_Plan_reviewer,My_*_Plan}, Context/ADAMRules/*.md, Context/ProjectArchitecture/*.md, backend/frontend READMEs, backend QUICK_REFERENCE.
- Data sources: `Content\UserInputs\ADAMSpecifications\*.xlsx` (ADSL default) + `Context\ADAMRules` as master rule source; rules file set remains source of truth for derivations per user note.
- Operational directives: full-page frontend scope, current release focuses on ADSL, continue using Gemini 2.5 Flash without provider overrides, minimize API calls, derive logic from any "Source/Derivation/Coding logic/Derivation logic/Programming notes" column, persist approvals per Study ID, ensure backend updates happen in this phase, validation against IG versions acknowledged as future enhancement, incorporate lightweight access control/logging hooks, do not run app while planning.

## 2. Target Experience & Guardrails
- UX: Always-visible high-contrast progress bar anchored near workspace bottom (per NN/g progress-indicator heuristics), tooltip with exact percent plus counts, responsive layout that respects existing vertical tabs plus two-column workspace, large legible typography, and WCAG AA contrast.
- Workflow: "Generate ADAM Code" button disabled until >=80% of variables are approved across tabs; tooltip explains requirement; confirmation modal previews steps, packages or PROC preferences, and any blocking conflicts before hitting backend.
- Data accuracy: Only approved variables feed final code generation; derivation text plus user notes flow through unchanged. Variable Analysis tab must remain accessible but no longer auto-load outside workspace, aligning with prior bugfix instructions.
- Performance: Cache by Study ID + dataset + standards + derivation hash to avoid redundant LLM calls, cap concurrency (3-4) with exponential backoff to avoid FastAPI 429 errors noted in logs, reuse cached snippets until invalidated.
- Security/compliance: Keep PHI/PII local, redact oversized fields, add request-id logging plus minimal auditing without introducing new auth flows yet.

## 3. Implementation Phases

### Phase A - Data & State Instrumentation
1. **Study-scoped store upgrades**: Extend Zustand store with `approvalsByStudy[studyId][variableId] = { approved, notes, derivationSource, updatedAt }`, track `totalVariables` plus `approvedVariables` snapshots, and persist via localStorage or IndexedDB with versioning to honor REFACTORING_PLAN guidance.
2. **Derivation resolver utility**: Build helper that scans spec row columns using ordered alias list and caches the resolved column/value per variable, logging which column satisfied the "Derivation source" rule for traceability.
3. **Backend contract alignment**: Confirm FastAPI bulk endpoint accepts `{study_id,dataset,language,standards,variables:[{name,derivation,userNotes,metadata}]}`. Add `derivation_source_column` plus `approval_status` fields so backend audits logic without extra calls.

### Phase B - Progress Telemetry & UI
1. **`useApprovalProgress` hook**: Memoized hook calculates totals, percentage, deficit to reach 80%, and boolean `isReadyForGeneration`, emitting aria-friendly data. Hook listens to approval toggles plus categorizedVariables updates.
2. **Progress bar component**: Fixed bottom rail with high contrast, gradient shift when threshold reached, tooltip showing `X of Y approved` plus Study ID and dataset, and ARIA `progressbar` semantics per Material Design 3 spec.
3. **Contextual cues**: Inject micro-copy in Variables and Rules tabs referencing progress (for example, chips per category) and short reminder banner in Standards tab so the user knows what remains.

### Phase C - CTA Gating & Confirmation Flow
1. **Button enablement**: Tie "Generate ADAM Code" (or renamed CTA per latest UI) to hook output; tooltip clarifies requirement when disabled; include analytics event when threshold met.
2. **Confirmation modal**: Summaries include total approved variables, standards selections, package or PROC preferences (tidyverse vs data.table; PROC SQL vs Data Step), and high-level plan steps. Provide editing shortcuts (jump to first unapproved variable, view notes).
3. **Loading states & feedback**: Within modal, show stepper (Collect Inputs -> Detect Conflicts -> Call Gemini -> Compile Program -> Display Output). Disable dismissal until request finishes; on success, scroll to code output pane and show toast plus download link; on failure, display actionable error referencing request id.

### Phase D - Backend & Generation Enhancements
1. **Payload shaping & caching**: Client sends only approved rows with resolved derivation plus notes; backend caches by `(study_id,dataset,variable,derivationHash,userNotesHash)` to minimize repeated calls and returns cached snippets until invalidated.
2. **Conflict detection**: Client-side keyword or regex scanner flags contradictory or ambiguous notes; modal blocks progression when `blocking` conflicts exist until user edits notes, satisfying requirement for pre-generation validation. Optionally log conflict summary to backend for auditing.
3. **Rate-limit resilience**: Backend adds guard to reject duplicate inflight requests per Study ID with 202/409 plus retry-after to avoid loops seen in `/categorize-path` 429 errors; client respects headers and surfaces countdown.
4. **Code assembly**: Backend ensures generated program (R or SAS) includes only approved variables, with comments referencing user notes and derivation source; incorporate package preferences and note warnings when packages absent.
5. **Access & logging**: Add middleware to stamp request ids, log studyId/dataset/language, and stub hook for future auth; ensure logs exclude PHI.

### Phase E - Persistence, Resilience & Performance
1. **Local persistence**: Store approvals, notes, cached snippets, and progress per Study ID in localStorage (or IndexedDB if more than 5 MB). Implement expiry plus manual "Reset study" action to clear stale data.
2. **Network orchestration**: Queue categorize and generation calls with concurrency cap and exponential backoff plus jitter; implement cancellation if user navigates away; display retry controls and offline-safe messaging.
3. **Instrumentation**: Capture metrics (cache hits, API calls, average latency, error codes) and expose via diagnostics drawer for QA; send minimal telemetry to backend only if request id/logging available.

### Phase F - Testing, Accessibility & Rollout
1. **Unit tests**: Cover approval math, derivation resolver, conflict detector, store migrations, modal state machine.
2. **Integration/E2E**: Simulate user uploading spec, approving variables, dropping below threshold to confirm auto-disable, regenerating after notes change, and verifying payload contains only approved rows.
3. **Accessibility**: Validate keyboard navigation, focus trapping in modal, screen reader announcements for progress updates, and contrast ratios.
4. **Docs & rollout**: Update README/help to describe new workflow, add feature flag for gradual release, document recovery steps if persistence corrupts, and align with ProjectArchitecture emphasis on user-friendly flow.

## 4. Known Gaps / Clarifications Needed
1. **Study/user identity**: Is client-side persistence sufficient, or should approvals be saved server-side against authenticated users or roles?
2. **Specification variants**: Do we expect non-English column headers or sheet names beyond current alias list that require configuration?
3. **Default package/PROC preferences**: Are there sponsor-mandated defaults we must set per Study ID, or is user selection remembered per browser only?
4. **IG validation assets**: Are machine-readable IG or terminology files already in `Content\StandardDocuments` for the "validate against IG version" stretch goal, or should we design a stub for future releases?
5. **Access control scope**: Should we integrate existing auth/logging infrastructure now (if available) or simply add request-id logging and revisit later?

Clarifying the above will enable a refined version in `Context/My_Revised_Plan.md` before implementation.

---

# Plan v2 — Variable Refresh by User Notes and Mapping‑Driven Categorization

Purpose: Incorporate the feature set from `Context/0_MyRequirement_planner.md` while preserving current behavior. This plan focuses on per‑variable regeneration driven by user notes and ensuring the Variables Analysis categories and order mirror `Context/ADAMRules/VariablesMapping.xlsx`.

## 1) Scope
- Add per‑variable "Refresh" that re‑generates only the clicked variable using the latest user notes and spec row.
- Keep bulk "Get AI Inputs" flow unchanged for first‑time fills; allow per‑row refresh to iterate.
- Strictly render categories and ordering in the UI according to VariablesMapping.xlsx; display names are cleaned for UX, but raw names (with numeric prefixes) are preserved for backend context.

## 2) Guiding Principles (Non‑breaking)
- Do not remove or change existing endpoints; extend request models with optional fields (e.g., `user_notes`).
- Keep existing store fields and augment with additive keys (per‑variable `isGenerating`, `lastGeneratedAt`).
- Maintain current toast/progress behaviors; add richer detail without changing keys used by other components.

## 3) Architecture Changes

### Frontend
- Store (Zustand)
  - Add `pairProgramming.isGenerating[variable]` (boolean), `lastGeneratedAt[variable]?: Date`.
  - Keep `snippets[variable]` schema; add optional `history?: Array<{ts: Date; code: string; rationale: string}>` as feature‑flagged extension.
- PairProgrammingArea
  - Refresh button triggers `adamApi.generateCodeSnippet` with payload: study_id, dataset, language, spec_row (verbatim), derivation, standards, context(category, required vars), and `user_notes` (from notes textarea).
  - Disable only the clicked row during generation. On success, update that row’s snippet and rationale; note `lastGeneratedAt`.
  - Preserve existing Copy/Accept behaviors; only this variable updates.
- VariablesAnalysisTab
  - On "Re‑categorize", if spec path begins with `Content/` or flagged as default → call `/specification/categorize-path`; otherwise (uploaded file) → call `/specification/categorize` (multipart). This ensures the uploaded file is always used.
  - Build `sortedCategories` via mapping names; strip numeric prefixes for display, persist raw names for backend context.
  - Tabs render in mapping order with formatted labels, counts from categorized result.

### Backend
- input_models.CodeSnippetRequest
  - Add optional `user_notes: Union[str, Dict[str, str]] = None` (backward compatible). If not present, legacy clients continue to work.
- api/v1/code_generation.generate_code_snippet
  - Read `user_notes` and incorporate into prompt context; pass study/dataset/standards as today.
  - Return same response shape (code_snippet, coding_rationale, metadata[, error]).
- code_generator/prompt_builder
  - Merge `user_notes` with spec row; establish precedence rules: User Notes > Spec hints > Default rules from ADAMRules.
  - Apply safety rails: deterministic sections, required variable checks, style preferences.
- Caching
  - Include user_notes and normalized derivation in cache key: `(study_id,dataset,variable,derivationHash,notesHash,language)` to avoid stale returns when notes change.

## 4) UX & Data Flow
1. User edits notes for variable `V`.
2. Click refresh on `V` → set `isGenerating[V]=true` → POST `/code-generation/generate-code-snippet` with notes/derivation/spec_row.
3. On success → update `snippets[V]`, `lastGeneratedAt[V]`, and clear `isGenerating[V]`.
4. On failure → show inline error with Retry for `V` only; other rows unaffected.
5. Re‑categorize always uses the active spec (uploaded or default) and renders categories in the exact spreadsheet order.

## 5) Error Handling & Fallbacks
- 404/Not Found on code generation (e.g., dev server without LLM): show non‑blocking toast and optionally synthesize placeholders (clearly labeled "offline mock").
- 429 rate limits: respect Retry‑After, backoff in throttler, surface countdown.
- Validation errors: inline error per row with actionable text (e.g., "Study ID required" link to Project tab).

## 6) Testing
- Backend unit: request model with/without `user_notes`; prompt builder includes notes; cache keys differ when notes change.
- Integration: generate‑snippet with a mocked provider; assert only targeted variable is affected.
- Frontend unit: per‑row spinner state, Retry flow, category order builder.
- E2E: upload spec → recategorize → edit 2 variables notes → refresh individually → verify only those rows change; verify tab order matches VariablesMapping.xlsx.

## 7) Rollout & Config
- Env: ensure at least one provider API key; default provider set in `.env`.
- Timeouts: per‑row 30–60s; bulk 120s+.
- Metrics: capture timing and error rates for per‑row refresh calls.

## 8) Open Questions (to confirm before implementation)
1. Persist notes/acceptance on server or keep client‑side only in this phase?
2. Maintain snippet history per variable for audit/compare?
3. Which provider/model defaults should we cement for production (vs. dev)?
4. Any sponsor‑specific templates to standardize header/comments across generated snippets?

When approved, this plan will be mirrored into `Context/My_Revised_Plan.md` with any clarifications incorporated.
