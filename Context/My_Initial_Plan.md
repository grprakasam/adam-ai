# My Initial Plan — “SDTM–ADaM Traceability” Panel

This plan implements a new “SDTM–ADaM Traceability” panel that documents end‑to‑end lineage for every ADaM variable back to source SDTM datasets, transformation logic, and ADaM IG rule references, aligned with FDA SDTCG §4.1.2.8. It is additive and non‑breaking, follows Context/ProjectArchitecture rules, and integrates cleanly with the current React (Ant Design) + FastAPI stack.

---

## 0) Inputs Reviewed (scope confirmation)

Primary requirement
- Context/0_MyRequirement_planner.md

Architecture and behavior (must adhere)
- Context/ProjectArchitecture/ProjectArchitecture.md
- Context/ProjectArchitecture/ProjectRequirements.md
- Context/ProjectArchitecture/TECH_STACK.md

Domain rules and flow
- Context/ADAMRules/ADSL_MacroLogic.md
- Context/ADAMRules/ADSL_ApplicationBehaviourRules.md
- Context/ADAMRules/ADAM_VariablenamingRules.md

Related status/planning (non‑binding but informative)
- Context/IMPLEMENTATION_STATUS.md
- frontend/README.md, backend/README.md
- backend/QUICK_REFERENCE.md, backend/CODE_REVIEW_LLM_SERVICE.md
- TESTING_FRAMEWORK_IMPLEMENTATION_SUMMARY.md

Observed gaps to note
- Context/ADAMRules/ADSL_IGSpecificRules.md is empty.
- Context/ADAMRules/VariablesMapping.xlsx referenced in docs is not present.
- ‘Content/StandardDocuments’ path referenced but not found in repo listing.

---

## 1) Objectives & Non‑Functional Requirements

Objectives
- Provide a first‑class Traceability panel (the tool’s USP) that: (a) visualizes lineage (graph), (b) tabulates traceability (matrix), (c) links ADaM IG rules, and (d) exports auditor‑ready documentation.
- Keep UX intuitive, domain‑centric, and coherent with current app structure.
- Be incremental and non‑breaking; hide behind a feature flag initially.

Non‑functional
- No regressions to existing tabs and flows (Setup, Datasets, Variables, Rules, Pair Programming, Consolidated Code, Testing).
- Performance: handle large specs (virtualized tables, incremental graph rendering, caching).
- Accessibility and consistency with Ant Design theming.
- Clear separation of concerns: frontend visualization; backend assembly/derivation where needed.

Compliance target
- Align outputs to FDA SDTCG §4.1.2.8 Traceability expectations and ADaM IG conventions; provide references and exportable evidence.

---

## 2) UX/IA Design (panel structure and interactions)

Panel placement (non‑breaking)
- Add a new RightPanel tab: “SDTM–ADaM Traceability” (after “Consolidated Code”).
- Optional quick‑entry from Variables/Pair Programming via a primary button “Open Traceability”.

Panel layout (Ant Design components)
1) Overview strip
   - Cards with study/dataset context (Study ID, Dataset, SDTM/ADaM IG versions), approval % reused from existing store.
   - “Generate/Refresh Traceability” button (disabled until spec parsed or any snippets exist).
2) Lineage Graph (React Flow or Cytoscape.js)
   - SDTM domains on left, transformation nodes in middle, ADaM variables on right.
   - Edge tooltips: transformation summary; click to open detail drawer.
   - Mini‑map + fit‑to‑view; category color coding.
3) Traceability Matrix (AntD Table with virtualization)
   - Columns: ADaM Variable | Label | Source SDTM Dataset(s) | Source Variable(s) | Transform/Algorithm | ADaM IG Rule Ref | Code Snippet Ref | Comments.
   - Row expanders for detailed derivation steps and rule text excerpts.
   - Filters: category, rule presence, variable name, domain.
4) Detail Drawer (right side)
   - Full derivation steps, linked code snippet(s), rule references with anchors, validation hints (naming/format from ADAM_VariablenamingRules.md).
5) Export & Share actions
   - Export to Excel (SheetJS), PDF (server‑side HTML→PDF), and Word (docx) with embedded lineage snapshot.

Visual polish
- Domain‑centric iconography (SDTM vs ADaM), badges, tags, and helpful empty states.
- Progressive disclosure: default to Overview + Matrix; graph loads on demand for speed.

---

## 3) Data Sources and Traceability Assembly

Primary inputs
- User specification Excel (Context/ProjectRequirements: uploaded to Content/UserInputs/ADAMSpecifications/).
- Generated code snippets and rationales from Pair Programming (store/backend).
- ADAM rules: naming rules, macro flow (Context/ADAMRules/*), plus future IG‑specific rules.

Assembly strategy (incremental, resilient)
1) Spec‑first mapping (MVP)
   - Parse spec columns (e.g., Variable, Label, Source/Derivation) to identify sources and initial algorithm text.
   - Heuristics to extract SDTM domains and variables from derivation text.
2) Code‑aware enrichment (Phase 2)
   - Parse generated R/SAS snippets to confirm/augment SDTM sources and operations (regex + lightweight parsers).
   - Cross‑check with naming rules (ADAM_VariablenamingRules.md) and macro flow for plausibility.
3) Rule linkage (Phase 3)
   - Map variables/algorithms to ADaM IG references (requires population of ADSL_IGSpecificRules.md or a new rules JSON).
4) Confidence scoring
   - Compute a confidence score per variable (spec‑only < spec+code‑confirmed), surfaced in UI.

Outputs (internal JSON model)
```json
{
  "dataset": "ADSL",
  "sdtm_version": "3.4",
  "adam_ig_version": "1.3",
  "variables": [
    {
      "name": "AGEGR1",
      "label": "Age Group 1",
      "sources": [{"domain": "DM", "variable": "AGE"}],
      "algorithm": "if AGE<65 then '<65' else '>=65'",
      "rule_refs": ["ADaM IG 1.3 §X.Y"],
      "code_refs": [{"language": "R", "id": "snip-AGEGR1"}],
      "confidence": 0.78,
      "notes": "Confirmed from code"
    }
  ]
}
```

---

## 4) Backend Additions (non‑breaking, feature‑flagged)

API design (FastAPI, Pydantic v2)
- POST `/api/v1/traceability/generate` → returns lineage JSON (inputs: study/dataset, spec path or in‑memory spec, optional snippets).
- GET `/api/v1/traceability/matrix/{studyId}/{dataset}` → cached matrix JSON.
- POST `/api/v1/traceability/export` → returns file (xlsx/pdf/docx) with embedded snapshot.

Services
- SpecParser: robust excel parser for spec columns used in derivations.
- CodeInspector: R/SAS snippet analyzer (phase 2) to extract SDTM variables/domains.
- RuleLinker: maps variables/algorithms to ADaM IG references (backed by maintainable YAML/JSON once provided).
- GraphBuilder: builds a DAG (networkx) for graph export; serializes to React Flow format.
- Exporter: pandas + xlsxwriter; WeasyPrint/ReportLab for PDF; python‑docx for Word.

Infrastructure
- In‑memory cache first; optional file cache under `Content/Traceability/`.
- Feature flag in config to enable/disable endpoints.
- No DB required for MVP; future: Postgres + Alembic for persistence and audit.

---

## 5) Frontend Implementation (React + Ant Design)

State
- Extend Zustand store with `traceability` slice: status, matrix, graph, lastGeneratedAt, confidence summary.
- Derive readiness from existing `categorizedVariables` and snippet availability.

Components
- `TraceabilityTab.tsx` (main tab): orchestrates Overview, Graph, Matrix, Export.
- `LineageGraph.tsx`: React Flow/Cytoscape visualization with mini‑map and tooltips.
- `TraceabilityMatrix.tsx`: AntD Table with column filters, virtual scroll, row expand.
- `RuleReference.tsx`: in‑panel rule text excerpt viewer + anchor links.
- `ExportActions.tsx`: xlsx/pdf/docx export controls.

Navigation & discoverability
- Add “Traceability” tab to RightPanel and a prominent button in Variables/PairProgramming.
- Preserve existing routes; feature flag controls visibility.

Visual/UX best practices (current 2024–2025)
- Progressive disclosure, skeleton loaders, optimistic updates on refresh.
- Keyboard navigation and ARIA roles; high‑contrast option.
- Snapshot banner with study/dataset/version chips and confidence.

---

## 6) Testing & Quality

Unit/integration
- Backend: SpecParser, CodeInspector, RuleLinker, GraphBuilder unit tests; endpoint contract tests.
- Frontend: component tests (matrix filters, drawers, exports), store selectors, rendering perf.

End‑to‑end
- Flow: upload spec → categorize variables → generate snippets (optional) → open Traceability → export matrix.
- Regression: ensure no changes to existing tabs’ behavior (golden snapshots for UI routes, API contracts unchanged).

Performance
- Virtualized table, graph chunking, memoized selectors; cache warmup for common datasets.

---

## 7) Rollout Plan (incremental, non‑breaking)

Phase 0: Guardrails
- Add feature flag; route hidden by default; no API auto‑calls.

Phase 1: MVP (spec‑first matrix)
- Spec parsing → Matrix table + basic export (xlsx). No graph, no code parsing.

Phase 2: Graph + Code‑aware enrichment
- Add LineageGraph; parse R/SAS snippets to confirm sources; add confidence scoring.

Phase 3: Rule references + PDF/Word export
- Link to ADaM IG refs; include rule text excerpts; branded PDF/Word exports.

Phase 4: Polish & QA
- Accessibility pass, performance tuning, error states, telemetry, help content.

---

## 8) Risk Management (keep existing features safe)

Compatibility
- Additive endpoints and UI; default disabled via flag. No changes to existing APIs or store shapes unless extended with new optional keys.

Data integrity
- Read‑only consumption of spec/snippets; never mutates existing generation artifacts.

Recovery
- Safe fallbacks: if code parsing or rules absent, still render spec‑only matrix with warnings.

Observability
- Structured logs for traceability generation steps; UI to surface recoverable errors and retry.

---

## 9) Open Questions (please confirm before execution)

1) Specification structure: which exact columns contain source SDTM and derivation logic? Please share a sample spec or define column names.
2) ADaM IG references: do you have a preferred source document and mapping format (YAML/JSON) to populate ADSL_IGSpecificRules? Which ADaM versions to support initially?
3) Export expectations: which formats are mandatory (Excel/PDF/Word)? Any corporate templates/branding to apply?
4) Datasets in scope for v1: only ADSL or also ADAE/ADLB/others?
5) Visual preference: React Flow vs Cytoscape for the graph? Any constraints on additional FE deps?
6) Where should generated artifacts be stored? Is `Content/Traceability/` acceptable for now?
7) Should traceability be computed automatically after snippet generation, or only on explicit user action?
8) Do we need hyperlinking from matrix entries to specific SDTM spec files or external standards docs?

---

## 10) Identified Missing Elements (to add to repo/plan)

- Variables mapping source: `Context/ADAMRules/VariablesMapping.xlsx` referenced but absent — needed for categorization/mapping.
- ADaM IG rules content: populate `Context/ADAMRules/ADSL_IGSpecificRules.md` (or provide a structured file) to enable rule references.
- Standards documents: add `Content/StandardDocuments/` with the FDA SDTCG and ADaM IG versions used, for in‑app linking and export citations.
- Example specification: a de‑identified sample spec to validate parsing logic and UX.

---

## 11) Definition of Done (v1 MVP)

- New “SDTM–ADaM Traceability” tab visible under feature flag; no regressions in existing tabs.
- Spec‑derived Traceability Matrix renders for ADSL with filters and row details.
- Export to Excel works with study/dataset header and timestamp.
- Clear warnings when rules or code refs are unavailable; graceful degradation.

## 12) Definition of Done (v2)

- Lineage Graph operational with zoom/minimap and tooltips.
- Code‑aware enrichment confirms SDTM sources from snippets; confidence scoring surfaced.
- PDF/Word exports include lineage snapshot and rule excerpts with references.

---

## Notes on “best/latest” methods (2024–2025)

- FE Graph: React Flow (active ecosystem) or Cytoscape.js for large graphs; AntD v5 for consistent theming; SheetJS for Excel export; docx/WeasyPrint for Word/PDF.
- BE Parsing/Export: pandas/xlsxwriter; networkx for DAG → React Flow JSON; fastapi background tasks for long‑running exports; Pydantic v2 for models.
- UX Patterns: progressive disclosure, helpful empty states, inline rule hints, optimistic updates, accessible keyboard navigation.

This plan is ready to execute after clarifications in section 9.
