# ADAM AI – Initial Execution Plan (ADSL‑First)

## Objectives
- Deliver an ADSL‑first, domain‑friendly AI pair‑programming web app that generates ADaM programs via LLM.
- Adhere to Context/ProjectArchitecture/ProjectArchitecture.md and ProjectRequirements.md without breaking existing UX flows.
- Implement both frontend and backend for the full page workflow, using Google Gemini 2.5 Flash as the only LLM provider initially.
- Treat Context/ADAMRules/* as the master rule source for prompts, checks, and UI guidance.
- Parse user‑uploaded ADaM specification Excel (stored under `Content/UserInputs/ADAMSpecifications/`) to drive variable‑level code generation.

## Non‑Breaking Principles
- Keep current component structure and state store (Zustand) intact; extend via well‑scoped modules.
- No regressions to navigation, theming, or stored state. Feature‑flag or route‑gate any new flows that could be disruptive.
- Preserve tab semantics and keyboard accessibility (ARIA, focus states) in any UI additions.
- Avoid renaming public API routes or changing response shapes without compatibility shims.

## Scope & Deliverables
- Frontend: Entire UI (Landing + Workspace) with tabs for Project Information, ADAM Specification, Standards, Rules, and Enter ADAM Dataset Name (kept last).
- Backend: FastAPI endpoints for spec upload/parse, rule loading, prompt assembly, LLM invocation, and code/validation payloads.
- LLM: Single provider integration (Gemini 2.5 Flash) with robust prompt templates and JSON‑structured output.
- Data: Normalized in‑memory model for ADSL specification rows and rule artifacts derived from Context/ADAMRules/.

## Architecture Alignment
- Frontend: React 18 + TypeScript + Vite, Zustand for app state, Ant Design selectively. Reuse existing components and TabNavigation.
- Backend: Python 3 + FastAPI, Pydantic v2 models, modular services (input collection, rule loading, llm), logging.
- Filesystem: Persist uploads to `Content/UserInputs/ADAMSpecifications/` and reference `Context/StandardDocuments/` and `Context/ADAMRules/` for rule/context loading.

## Primary User Journeys
1) Landing → Start Project → Workspace with tabs.
2) Configure Project Information → Select Standards → Review/Enable Rules → Upload ADaM Specification Excel → Choose Dataset (ADSL) → Generate → Review code & validation.
3) Optional: Use chat assistant to clarify missing metadata and confirm assumptions.

## Frontend Plan
- Navigation & Layout
  - Keep current left tab order with labels updated; ensure dataset name tab remains last.
  - Header contains Back to Landing and LLM/provider status per existing UI.
- Project Information Tab
  - Keep current fields (studyId, protocolNumber, therapeuticArea, studyPhase). Add inline validation and helpful descriptions.
- ADAM Specification Tab
  - File uploader (xlsx primary). Show file name, size, validation status.
  - On successful upload, call backend parse endpoint → show parsed variable table preview (variable, type, label, derivation summary, dependencies).
  - Persist specId returned by backend in store.
- Standards Tab
  - Maintain selection of SDTM, ADaM IG, MedDRA versions. Surface compatibility hints.
- Rules Tab
  - Load ADSL rules from backend (which aggregates Context/ADAMRules/*). Display grouped by category (e.g., Variable Naming, IG‑Specific, Macro Logic, App Behaviour).
  - Allow enabling/disabling rule groups and show badges for coverage.
- Enter ADAM Dataset Name (Last)
  - Radio/select preset: ADSL (default). Leave ADAE/ADLB placeholders disabled for future.
- Generate CTA & Right Panel
  - Keep Get Started primary CTA (disabled <80% completion). On click, call generate endpoint.
  - Right panel: code (Monaco), validation results, derivation sequence, metrics, documentation; hydrate from backend response.
- Accessibility & UX
  - Ensure tablist/tabpanel semantics, focus rings, and keyboard navigation. Color contrast for badges/borders meets reasonable standards.

## Backend Plan
- API Routes (initial)
  - POST `/api/spec/upload` (multipart/form‑data): save Excel → returns `{specId, filename, size, datasetGuess}`.
  - POST `/api/spec/parse`: `{specId}` → parses Excel into normalized rows → `{variables: [...], warnings: [...]}`.
  - GET `/api/rules/adam/adsl`: returns canonical rule set merged from Context/ADAMRules/.
  - POST `/api/generate/code`:
    - Input: `{specId, dataset: "ADSL", standards, rulesEnabled, options: {language: "R"|"SAS", comments, style, optimization}}`
    - Flow: load spec + rules → build prompt → call Gemini 2.5 Flash → return `{code, validationResults, derivationSequence, metrics, documentation}`.
  - POST `/api/validate/code` (optional early): static checks/lints; returns structured findings.
- Services
  - Specification Service: load/save metadata, parse Excel (openpyxl/pandas), validate required columns, map to ADSL entities.
  - Rules Service: read Context/ADAMRules/*, build typed structures (categories, conditions, precedence), expose query helpers.
  - Prompt Builder: dataset‑aware templates; inject standards versions, rule constraints, and spec rows; request JSON‑structured auxiliary output.
  - LLM Provider: Gemini 2.5 Flash client wrapper with retries, timeouts, and token accounting; redact sensitive paths.
- Models (Pydantic v2)
  - SpecVariable: `name, label, type, source, derivationLogic, dependencies[], controlledTerms?, comments?`.
  - Standards: `sdtmVersion, adamIgVersion, medraVersion`.
  - Rule: `id, category, title, description, severity, references[]`.
  - GenerationRequest/Response (mirror FE contracts above).
- Files & Security
  - Save uploads under `Content/UserInputs/ADAMSpecifications/` with UUID filenames; enforce size/type checks.
  - Sanitize paths; never execute uploaded content.

## LLM Prompting (ADSL‑First)
- System intent: “You are a senior ADaM programmer generating ADSL in strict compliance with ADaM IG and provided rules.”
- Context blocks:
  - Standards snapshot (SDTM/ADaM IG/MedDRA versions).
  - ADSL‑specific rules (from Context/ADAMRules/ categories).
  - Minimized spec rows (only what’s needed per variable).
- Output policy:
  - Return final code only (no chain‑of‑thought), with optional descriptive comments controlled by `options.comments`.
  - Use consistent dataset in code, strong typing, and defensives (missing values, date handling).
- Structured side output (JSON): validation findings, derivation sequence, and variable docs for the UI panels.

## Data & Parsing Expectations
- Excel input (xlsx) contains rows mapping to variables with derivation guidance.
- Parser validates required columns (name, label, type, derivation/source/conditions). Non‑critical gaps become warnings.
- Map variable names to ADSL conventions; apply Context/ADAMRules/VariableNaming.

## Validation & Quality
- Frontend
  - Form validation; disable CTA until 80% completion (project info, standards, rules selection, spec uploaded, dataset chosen).
  - Graceful error toasts with retry.
- Backend
  - Unit tests: spec parsing, rule loading, prompt builder (golden template test), LLM client errors.
  - Integration tests: upload → parse → generate (mock LLM) → verify response shapes.
  - Static analysis: ruff/flake8, mypy; TypeScript `tsc --noEmit`.

## Observability & Logging
- Correlate requests via requestId; log phases (upload/parse/build/generate) with durations.
- Capture LLM call metadata (model, tokens, latency) without persisting prompt contents by default.

## Performance & UX Targets
- Upload/parse under 3–5s for typical specs (<5MB).
- LLM generation <10–15s; show progress/streaming and allow cancel.
- Code‑split editor and heavy panels; lazy‑load only when needed.

## Security Considerations
- Enforce file type/size; quarantine unknown types.
- Validate and sanitize all user inputs; never evaluate uploaded code.
- Keep API keys in env vars; never send to client.

## Milestones (Two Sprints)
- Sprint 1 (Backend foundations)
  - Upload/parse endpoints, rule loader, prompt builder scaffold, mock LLM, API contracts, unit/integration tests.
- Sprint 2 (Frontend & LLM integration)
  - Spec tab wiring, rules UI from backend, generate flow to Gemini 2.5 Flash, right‑panel hydration, validations, polish.

## Acceptance Criteria
- Can upload real ADSL specification Excel and see a parsed preview with warnings.
- Can select standards and rules; completion reaches ≥80% when inputs are sufficient.
- Clicking Get Started returns syntactically correct ADSL code and companion JSON payloads for validation/sequence/docs.
- No regressions in navigation, theming, or saved state across refresh.

## Risks & Mitigations
- Spec variability → defensive parser + clear warnings.
- LLM determinism → template‑driven prompts, sampling controls, and linting.
- Rule/version drift → centralize rule metadata with version tags and tests.

## Open Items (Future)
- Expand beyond ADSL (ADAE/ADLB), richer validations (runtime with sample SDTM), export packages, and multi‑provider LLM abstraction.

