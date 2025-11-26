# Code Review Tab Redesign Plan (Intermediate Step)

## 1. Goals & Scope
- Position Code Review as the bridge between Pair Programming and Consolidated Code, focusing on variables flagged for modification and iterative refinement until user approval.
- Keep UI flow, data structures, and APIs aligned with existing pair programming outputs and consolidated code expectations; avoid regressions to current review, PDF export, or code generation paths.
- Deliver a card-based, pair-programming-like layout that captures user intent, supports repeated AI calls, and preserves variable-level approval states.

## 2. Assumptions & Constraints
- Single-user review (MVP) with per-variable approval states; multi-user/comment threads deferred.
- Soft warning only on Consolidated Code if review not approved (no hard gate); PDF export remains required.
- No new core dependencies; reuse React 18/TS, Ant Design, Zustand, FastAPI services, and existing `adamApi` contract, extending endpoints where needed.
- Feature should respect existing dataset/study/language context and work with current pair programming snippet format (`VariableSnippet`).
- Performance: baseline table/card rendering acceptable; pagination/virtualization not required for MVP.

## 3. Current Behaviour to Preserve
- Loading or creating review sessions via `loadCodeReviewSession`, showing current status tags, and allowing session-level approve + PDF export.
- Pair Programming generates `pairProgramming.snippets` (code, pseudo, rationale, userNotes, accepted flags) and tracks generating state per variable.
- Consolidated Code can be generated even if review incomplete, but should surface warning; pass approved snippets and user notes downstream.
- Existing Code Review API set (session CRUD, comments, export) and store fields (`codeReviewSession/status/comments`) remain backward compatible.

## 4. Target UX & Interaction Flow
- Entry: when landing on Code Review with a study/dataset/language, auto-load review session and ingest latest pair programming snippets; empty state points user back to generate snippets first.
- Layout: replace table-first view with responsive cards (grid on desktop, stacked on mobile) mirroring Pair Programming visuals; include inline filters (status, category) and search.
- Card content: variable name/label/category, status pill, last updated timestamp, pseudo-code preview, code snippet preview with expand, user notes textarea, comment count, and acceptance toggles (Approve, Request changes).
- Iteration controls: per-card "Update with AI" button that sends the variable, latest notes, and pseudo/code context to backend; show spinner + optimistic status `in_review`; allow re-run until approved.
- Bulk actions: checkbox/select for variables marked for modification; toolbar buttons for bulk regenerate, bulk approve, and bulk move to consolidated payload.
- Transition cues: banner reminding this is the intermediate step; footer CTA "Proceed to Consolidated Code" enabled anytime but highlights pending items.

## 5. Frontend Data/State Updates (Zustand)
- Add `reviewVariables` map keyed by variable with fields: status (pending/approved/changes_requested), latestSnippetRef (ties to `pairProgramming.snippets`), userNotes, versionHistory (timestamps + code hash), lastUpdated, isRegenerating, errors.
- Derive `modificationQueue` from `pairProgramming.snippets` where `accepted === 'modify'` or user manually marks as "Needs changes" in Code Review.
- Extend actions: `setReviewVariableState`, `setReviewRegenerating`, `setReviewNote`, `appendReviewHistory`, `bulkUpdateReviewStatuses`, `syncReviewFromPairProgramming(snippets)`.
- Keep a selector for `reviewCompletion` (percent approved) and reuse for Consolidated warning; ensure resets when study/dataset/language changes.
- Persist minimal review state (status/notes/history) via existing persistence middleware; avoid persisting transient spinners.

## 6. Backend/API Plan
- Session sync: ensure `/code-review/session/{id}/load-snapshots` accepts `VariableSnippet` payload (code, pseudo, rationale, user notes, accepted) and stores variable snapshot with versioning metadata (source run id, timestamp, hash).
- Regeneration endpoints:
  - `POST /code-review/session/{id}/variables/{variable}/regenerate` with body {notes, current_code, pseudo, rationale, language, dataset, study_id, metadata}; returns updated snippet + rationale + pseudo summary.
  - `POST /code-review/session/{id}/variables/bulk-regenerate` for an array of variables marked for modification; reuse batching/caching from code-generation service.
- Status endpoints: keep `/variables/{variable}/status` for APPROVED/CHANGES_REQUESTED/PENDING; add optional `comment` to attach lightweight note.
- Comments/PDF: keep existing routes; update PDF generator to include latest regenerated code and notes per variable (one per page) plus review status.
- Consolidated handoff: extend program-generation payload to optionally consume `review_snapshot_id` or enriched variable list so consolidated code uses latest approved snippets and user notes.
- Observability: log regenerate requests (variable, language, model, latency, cache hit) and flag consecutive failures; return stable IDs for history tracking.

## 7. Integration Flow (Pair Programming ? Code Review ? Consolidated)
- Ingest: when opening Code Review, auto-sync from `pairProgramming.snippets` to create/update review variables; pre-select those with `accepted === 'modify'` as needing action.
- Iteration loop: user edits notes ? clicks Update with AI ? store sets `isRegenerating`, call backend regenerate ? update snippet and history ? allow Approve or Request changes.
- Approval logic: session APPROVED only when all review variables are approved; update `codeReviewStatus` accordingly and surface soft warning in Consolidated tab if not approved.
- Handoff to consolidated code: when generating, send reviewed snippets (approved + pending) with statuses and user notes; include flag so consolidated API can emphasize approved logic and leave TODO markers for pending.
- Dataset/language switch: prompt to save/discard review state; clear transient state and reload snapshots for the new context (per approved decision).

## 8. Edge Cases & UX States
- No snippets available: show Empty with CTA to Pair Programming.
- Stale snapshots: if pair programming snippets are newer than stored review snapshots (hash mismatch), highlight "New version available" and offer quick sync.
- API failures: surface inline error on the card, allow retry; keep previous snippet visible; avoid losing user notes.
- Long-running regenerations: show per-card spinner and disable actions for that card; allow other cards to proceed.
- Large variable sets: keep page-size pagination option as fallback; maintain current soft warning banner for review-incomplete state.

## 9. Testing & Validation
- Unit: Zustand actions/selectors, card component state changes, API client methods for regenerate/status sync.
- Integration: flow from Pair Programming ? Code Review ? Consolidated with mock API; verify statuses, notes, and updated snippets persist across navigation and reloads.
- Visual/UX: responsive card layout, focus states, keyboard navigation for notes/actions; ensure readability for pseudo-code and code blocks.
- API: contract tests for new regenerate endpoints and snapshot loading; ensure PDF export reflects latest code and statuses.
- Regression: ensure existing code generation, review status updates, PDF download, and consolidated code generation continue to work.

## 10. Feature Flag & Rollout
- Gate redesigned Code Review UI and regenerate endpoints behind an environment flag (e.g., `REVIEW_UI_V2_ENABLED`); fallback to current table view if disabled.
- Plan staggered rollout: enable in staging first, capture telemetry on regenerate latency and error rates, then enable in production.

## 11. Open Questions
- Should we keep history length capped (e.g., last 5 regenerations) or store all versions for audit?
- Do we need explicit diff view between versions (code/pseudo) for reviewers?
- Should bulk regenerate respect server-side rate limits differently from regular batch generation (custom concurrency)?
- Are there study-level review approvals beyond variable-level needed for launch?
