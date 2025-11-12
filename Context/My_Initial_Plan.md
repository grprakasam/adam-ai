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
