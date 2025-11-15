# My Initial Plan — “My Validation” Panel

## Summary & Goals
- Add a new workspace tab named `My Validation` placed after `Pair Programming` and before `Consolidated Code` in the right panel.
- Purpose: provide a pre‑generation review to confirm variable derivations and user acceptance before final program generation.
- Scope of edits inside this panel: users can only (a) change acceptance (Accept/Modify) and (b) trigger regenerate (same behavior as in Pair Programming). No re‑categorization or spec metadata edits here.
- Gating: allow consolidated generation with whatever variables are approved (no 100% requirement). Clearly communicate any non‑approved variables.
- Persistence: store acceptance/validation history so users can access decisions later (local persistent store). Simple local history (non‑audited) is sufficient for now.
- Rules surfaced: display ADaM naming/format warnings using Context/ADAMRules (e.g., suffix checks, DATE9/DATETIME19, FL flags) as inline non‑blocking hints.

This plan follows Context/ProjectArchitecture/ProjectArchitecture.md and ProjectRequirements.md, leverages the existing tech stack and store patterns, and avoids breaking current features.

## Non‑Functional Requirements
- Maintain current flows and state (no regressions). Pair Programming remains unchanged.
- Keep UI simple, professional, accessible (Ant Design components, keyboard-friendly controls, sensible empty states).
- Persist decisions locally via Zustand persistence (already used in project). Avoid backend changes for v1.
- Keep performance solid for large variable lists (virtualized list/table where beneficial).

## Information Architecture & UX
- RightPanel workspace tabs: `Pair Programming` → `My Validation` → `Consolidated Code`.
- Visibility: show `My Validation` only when at least one code snippet exists. Otherwise, show an empty state with CTA to generate snippets in `Pair Programming`.
- Layout: a compact, readable checklist table grouped by category.
  - Recommended: Ant Design Table with sticky header and optional virtual scroll for many rows.
  - Rows = variables; group by category from `categorizedVariables`.
  - Columns:
    - Variable (name, Required badge)
    - Category (read‑only, derived from categorization)
    - Derivation (read‑only, from spec column “Source/Derivation”)
    - Snippet Status (Generated/Not generated/Error)
    - Acceptance (radio: Accept/Modify; mirrors `pairProgramming.snippets[variable].accepted`)
    - Actions (Regenerate button; uses same API call and pattern as Pair Programming)
    - Warnings (non‑blocking tags derived from Context/ADAMRules checks)
- Top summary bar:
  - Approval progress (reuse `useApprovalProgress`): X of Y approved (Z%).
  - “Generate Consolidated Code” button present but shows a warning if no approved variables yet.
  - Note: no hard gating—generation allowed with approved subset only.
- Empty states and hints:
  - If no snippets exist, instruct: “Generate code in Pair Programming, then return here.”
  - If some variables are Modify or missing snippets, show non‑blocking reminder: “Unapproved variables will be excluded from consolidated generation.”
- Accessibility & polish:
  - Keyboard navigable radios and buttons; visible focus states.
  - Tooltips explaining Accept vs Modify and Regenerate requirements.
  - Compact spacing; consistent with project theme (indigo/purple, Ant tokens).

## Client‑Side Validation Rules (from Context/ADAMRules)
Implement light, non‑blocking checks shown as badges per variable row:
- Suffix Rules (Context/ADAMRules/ADAM_VariablenamingRules.md):
  - Names ending in `DT` should represent dates; `DTM` datetime; `FL` flags; `GRy` groups; `N` numeric equivalents; treatment/phase naming patterns (e.g., TRTxxP/A, APxxSDT/APxxEDT).
  - Show warnings if observed metadata suggests mismatch (e.g., type not aligned with suffix).
- Format Hints:
  - For `DT`, hint DATE9.
  - For `DTM`, hint DATETIME19.
  - For `FL`, hint Y/N/null constraint.
Notes:
- This panel does not enforce formats; it informs users so they can ensure the final program applies these.
- Use existing variable metadata (type/length/format/extra) where available; when insufficient, show “Check format in final code.”

## State Management
- Reuse existing `pairProgramming.snippets[variable]` structure (acceptance and notes already exist).
- Add lightweight, persisted local history:
  - `validationHistory: Array<{ ts: string; variable: string; action: 'accept' | 'modify' | 'regenerate'; before?: any; after?: any; note?: string }>`
  - Store actions when acceptance changes or regenerate is triggered from `My Validation`.
- Extend `useApprovalProgress` (if needed) to expose:
  - `hasAnySnippet: boolean`
  - `approvedCount`, `pendingCount`
- No changes to categorization state; this panel does not reassign categories.

## Gating Behavior (Consolidated Generation)
- Update logic to allow generation with the approved subset:
  - `canGenerateConsolidated()` returns true if at least one variable has `accepted === 'accept'` and a non‑empty `codeSnippet`.
  - UI shows a warning banner when some variables are not approved; generation still proceeds with the approved set only.
- The `ConsolidatedCodeTab` already builds `approvedVariables` from accepted snippets. No server change required.

## API & Backend
- No backend changes required for v1 (per requirement to save so users can access later via local persistence).
- Future (optional backlog): endpoints to persist user adjustments across machines/sessions:
  - `POST/GET /api/v1/specs/categorization` and `POST/GET /api/v1/validation/session`.

## Implementation Steps (Frontend)
1) Store updates (frontend/src/store/projectStore.ts)
   - Add `validationHistory` array and `addValidationHistoryEntry(entry)` action.
   - Ensure persisted storage includes the new property (keep `partialize` behavior consistent).
   - Add selector helpers as needed (e.g., `hasAnySnippet`).

2) Progress hook (frontend/src/hooks/useApprovalProgress.ts)
   - Confirm it already returns counts and percentage; extend to expose `hasAnySnippet` if convenient.

3) New component: `MyValidationTab.tsx`
   - Data: derive rows from `categorizedVariables.categories[*].variables` + `pairProgramming.snippets` overlay.
   - Table columns (see IA & UX above).
   - Acceptance radio updates `setPairProgrammingAcceptance(variable, value)` and logs to `validationHistory`.
   - Regenerate button calls the same API pathway used in Pair Programming (via `adamApi.generateCodeSnippet`), then updates snippet and history.
   - Warnings column: implement `validateADAMVariableMeta(variableInfo)` returning string tags based on Context rules.
   - Empty state CTA to switch to `Pair Programming`.

4) Right panel integration (frontend/src/components/RightPanel.tsx)
   - Insert `My Validation` tab between `Pair Programming` and `Consolidated Code`.
   - Show tab only if `hasAnySnippet` is true; otherwise, show an empty state or keep the tab disabled with a tooltip.

5) Gating relaxation (frontend/src/store/projectStore.ts)
   - Update `canGenerateConsolidated()` to return true when at least one approved snippet exists.
   - In `ConsolidatedCodeTab.tsx`, keep building `approvedVariables` as it does; ensure the UI shows a notice when generating with a partial subset.

6) Styling
   - Add `MyValidationTab.css` using the existing theme tokens (e.g., primary color, border radius).
   - Ensure consistency with Pair Programming visuals (badges, chips, subtle shadows, sticky header).

7) Telemetry (optional, local only)
   - Count acceptance changes and regenerations to inform future UX improvements (no network calls).

## Testing Strategy
- Unit/logic tests (if test infra present) for:
  - `validateADAMVariableMeta()` against sample names/meta.
  - Store actions: `setPairProgrammingAcceptance`, `addValidationHistoryEntry`, and `canGenerateConsolidated()` behavior.
- Component tests for `MyValidationTab.tsx`:
  - Renders categories/variables correctly.
  - Acceptance toggling updates store and UI.
  - Regenerate disabled state when required data missing; enabled when conditions met.
  - Warnings appear for known suffix cases.
- Manual QA walkthrough:
  1. Upload spec → categorize.
  2. Generate some snippets (Pair Programming).
  3. Open My Validation → Accept subset, leave others Modify.
  4. Generate Consolidated Code → only approved variables included; notice warns about incomplete approvals.
  5. Persist decisions; reload app → history and acceptance remain.

## Backward Compatibility & Data Migration
- Keep existing persisted storage intact; new keys are additive.
- Do not change existing field names or semantics in `pairProgramming.snippets`.
- If increasing persist version, add a safe migration step that preserves all prior state keys and defaults `validationHistory` to an empty array when absent.

## Risks & Mitigations
- Risk: Users expect to edit categories/metadata here. Mitigation: tooltips and copy explaining scope (acceptance + regenerate only), with a link back to Pair Programming for deeper edits.
- Risk: Large specs slow rendering. Mitigation: virtualized table, memoized selectors, and stable keys.
- Risk: Confusion about partial generation. Mitigation: clear banner text and pre‑generation confirmation summarizing included/excluded variables.

## Rollout Plan
- Phase 1: Implement tab with acceptance/regenerate, warnings, and relaxed gating.
- Phase 2: Virtualization and polish (if needed for very large specs).
- Phase 3 (optional): Export/import of validation decisions as JSON for portability.

## Deliverables
- New `My Validation` tab integrated in the right panel.
- Updated store with `validationHistory` and relaxed `canGenerateConsolidated()`.
- Warnings derived from Context/ADAMRules surfaced inline.
- Styles aligned with existing theme.

## Notes (Confirmed Constraints)
- Tab placement: between `Pair Programming` and `Consolidated Code`.
- Edits allowed: change acceptance and trigger regenerate only.
- Gating: no hard criteria—allow generation with approved subset.
- Persistence: local (Zustand persistence) with simple non‑audited history.
- Derivation column label: “Source/Derivation”.
