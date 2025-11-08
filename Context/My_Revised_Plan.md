# ADAM AI Code Generator — Revised MVP Plan (ADSL)

## Document Info
- Date: 2025-11-08
- Scope: MVP focused on ADSL dataset only
- Decisions (confirmed):
  - Backend: FastAPI
  - Frontend: React + TypeScript (keep current plan)
  - Code generation: SAS and R (user choice)
  - LLM: Default Google Gemini 2.5 Pro; provider-agnostic interface
  - Deployment: Local (no Docker yet)
  - Inputs: Excel spec in `Content\UserInputs\ADAMSpecifications\`; standard docs in `Content\StandardDocuments\`
  - IG-specific rules: TBD for now
  - Create required directories if missing

---

## 1) Scope & Success Criteria
- Dataset scope: ADSL only for MVP; ADAE/ADLB follow later.
- Behavior: After spec upload, drive a rule-based, categorized flow (per `ADSL_ApplicationBehaviourRules.md`) and progressively generate/edit SAS or R code to produce ADSL using SDTM inputs (DM/DS/EX/AE/LB per MacroLogic).
- Success criteria (MVP):
  - Spec upload works; variables categorized and decoded (e.g., `TRTxxP`, `AGEGRy`, `APxxSDT`).
  - Guided confirmations at each step; user selects SAS or R at start.
  - Provider-agnostic LLM interface works with Gemini 2.5 Pro by default.
  - Generated code shown in editor, downloadable, and saved to disk with metadata.
  - Static validations: variable coverage, naming conventions, rule adherence checks, and warnings.

---

## 2) Architecture Overview (MVP)
- Frontend (React + TypeScript)
  - Views: Upload & Mapping, Variable Categories, Chat/Guided Steps, Code Review (Monaco), Validation & Warnings, Download & Summary.
  - State mgmt: lightweight (e.g., context + hooks) for MVP; persist session in backend.
  - Accessibility: keyboard navigation, clear error states.

- Backend (FastAPI)
  - Endpoints:
    - `POST /spec/upload`: accepts Excel; returns inferred headers; stores file.
    - `POST /spec/map`: save column-mapping decisions.
    - `GET /rules/adsl`: parsed rules from `Context\ADAMRules\*`.
    - `POST /generate`: provider, language (SAS|R), context payload; streams or returns code.
    - `POST /validate`: static checks on generated code vs spec/rules.
    - `POST /save`: persists code, metadata, and warnings.
  - Services: rules parser, spec parser, prompt builder, provider client, validation service, persistence.

- LLM Providers
  - Default Gemini 2.5 Pro; interface supports future OpenAI/Anthropic.
  - Config via env (e.g., `GOOGLE_API_KEY`, `PROVIDER=google`, `MODEL=gemini-2.5-pro`).
  - Retry/backoff, error normalization, optional streaming.

- Storage & Paths (create if missing)
  - Specs: `Content\UserInputs\ADAMSpecifications\`
  - Standards: `Content\StandardDocuments\` (IG version, dictionary files)
  - Outputs: `Content\Generated\ADSL\{timestamp}\{SAS|R}\ADSL.{sas|R}`
  - Logs: `Content\Logs\{date}.log`
  - Sessions: `Content\Sessions\{session_id}.json`

---

## 3) End-to-End User Flow (MVP)
1. Start: User selects dataset = ADSL, language = SAS or R.
2. Upload Excel spec to `Content\UserInputs\ADAMSpecifications\` via UI.
3. Column detection & mapping:
   - Auto-detect columns; present an interactive mapping UI for required fields (minimally: `Variable`).
   - User confirms which column holds “Variable” and optionally maps label/derivation columns if present (no assumptions).
4. Rule load:
   - App loads `ADSL_ApplicationBehaviourRules.md` and `ADSL_MacroLogic.md`.
   - IG-specific rules are TBD; expose an optional IG Version selector based on files in `Content\StandardDocuments\`.
5. Categorized variable view:
   - Variables from the spec are grouped per categories stated in `ADSL_ApplicationBehaviourRules.md` (Subject IDs, Demographics, Treatment, Dose, Dates, Disposition, Flags, Phase Time, Analysis Groupings).
   - Decode family patterns (e.g., `TRTxxP` → `TRT01P`, `TRT02P`; `AGEGRy` → `AGEGR1`, etc.).
6. Guided confirmations (rule-driven):
   - For each category, confirm required variables exist; highlight missing/extra.
   - Confirm IG version/dictionary references if needed.
   - Capture any clarifications (e.g., unit assumptions, derivation preferences) before generation.
7. Code generation (LLM):
   - Prompt builder assembles context: spec selections, category focus, MacroLogic sequencing, language (SAS|R), and compliance constraints.
   - Generate code in steps aligned to MacroLogic (period/phase vars, treatments, date-time, disposition, death, groupings, labels/attributes).
8. Review & edit:
   - Show code in Monaco with SAS/R syntax highlighting.
   - Provide diffs as code refines across steps.
9. Validation:
   - Static checks: variable coverage vs spec; naming conventions; presence of SDTM input references (DM/DS/EX/AE/LB); simple pattern checks for date/time derivations.
   - Present warnings/errors with actionable suggestions.
10. Save & download:
   - Save final code + metadata to `Content\Generated\ADSL\{timestamp}\{SAS|R}\`.
   - Allow download; persist session state and decisions.

---

## 4) Functional Modules & Key Tasks

### A. Input Collection & Validation
- Objectives: Upload, detect columns, map required fields; collect dataset/language choice.
- Inputs: Excel spec; user mapping selections.
- Outputs: Canonical spec JSON with variables list and any per-variable attributes available.
- Tasks:
  - File upload with size/type checks; store file path.
  - Header extraction; propose auto-mapping; require user confirmation for “Variable” column.
  - Optional mapping for attributes (Label, Type, Derivation) if present.
  - Persist mapping alongside session.

### B. Rules Loading & Processing
- Parse `ADSL_ApplicationBehaviourRules.md` to:
  - Enumerate categories and variable families (e.g., `TRTxxP`, `AGEGRy`, `APxxSDT`).
  - Produce machine-readable category definitions and decoding regex.
- Parse `ADSL_MacroLogic.md` to:
  - Extract derivation phases and their ordering (period/phase → treatment → datetime/duration → disposition → death → groupings → labels/attributes).
  - Identify required SDTM inputs: DM, DS, EX, AE, LB.
- IG-specific rules: treat as TBD; leave hook for future parsing.

### C. Spec Parser & Variable Categorizer
- Build a categorizer that:
  - Matches spec variables to categories; flags unmatched or missing.
  - Decodes pattern families into enumerated instances (e.g., TRT01P, TRT02P) based on spec presence.
  - Produces category-wise lists for the UI and generation context.

### D. Variable Pattern Decoder
- Implement regex-driven decoding for small-letter placeholders per rules:
  - `TRTxxP|TRTxxPN|TRTxxA|TRTxxAN`, `APxxSDT|APxxSTM|APxxETMF`, etc.
  - `AGEGRy|AGEGRyN`, `AGGRy` families, etc.
- Expose utility that, given a pattern family and the spec, resolves actual variable instances.

### E. Context Builder & State Management
- Maintain session-scoped context:
  - Dataset=ADSL, language=SAS|R, mapped columns, variables by category, IG/dictionary selection, MacroLogic phase state.
- Token/size management: include only relevant rules and variables for each generation step.

### F. Prompt Engineering
- Provider-specific prompt templates (Gemini default):
  - System: role as expert SAS/R + ADaM programmer; must follow CDISC and provided rules.
  - Context: selected categories, resolved variables, MacroLogic phase, IG/dictionary refs (as available), constraints (naming, conventions).
  - Instruction: generate only code fences in target language; avoid placeholders; explain assumptions in comments if unavoidable.
- Chunking strategy:
  - Generate per MacroLogic phase with cumulative context.
  - Summarize long rule texts to fit token limits.

### G. LLM Integration
- Abstraction: `ProviderClient` with methods: `complete()`, `stream()`.
- Gemini 2.5 Pro default implementation; pluggable keys via env.
- Retries/backoff; error normalization and surfaced UI messages.

### H. Code Generation Orchestrator
- Drives phase-by-phase generation for ADSL:
  1) Period/Subperiod/Phase variables (APxx*, etc.)
  2) Treatment variables (TRT0xP, TRT0xA)
  3) Datetime & Duration (TRTSDTM, TRTEDTM, TRTDURD)
  4) Disposition variables
  5) Death variables & LSTALVDT
  6) Groupings & Populations
  7) Labels & Attributes
- Merges generated blocks into a single program file (SAS or R) with clear section headers.

### I. Validation & QA Checks (Static for MVP)
- Coverage: every spec variable either generated or explicitly ignored with reason.
- Naming: variables match allowed patterns/categories; flags for unknowns.
- Inputs: references to DM/DS/EX/AE/LB present when required by phase.
- Structural: basic syntax patterns (balanced quotes, proc/data step markers for SAS; library usage for R) — best-effort static checks.
- Report: warnings and errors ranked by severity; downloadable as JSON.

### J. UI/UX
- Category sidebar with counts and status (confirmed/pending/missing).
- Guided chat-like stepper aligned with rules; gated confirmations per category.
- Monaco editor with language mode (SAS or R) and diff view for iterations.
- Validation panel with filters (errors/warnings/info) and quick-jump to affected sections.
- Download buttons (program file, metadata, warning report).

### K. Output Management & Persistence
- Write outputs to `Content\Generated\ADSL\{timestamp}\{SAS|R}\`.
- Save session JSON: spec mapping, selections, IG version, provider, prompts (optional), warnings.
- Logging: append to `Content\Logs\{date}.log` with trace ids.

### L. Config & Secrets
- `.env` (not committed): `PROVIDER=google`, `MODEL=gemini-2.5-pro`, `GOOGLE_API_KEY=...`.
- Feature flags: `ENABLE_STREAMING`, `SAVE_PROMPTS`.

---

## 5) Non-Functional Requirements
- Reliability: clear error messages and recovery (re-run a failed phase).
- Performance: paginate large specs; chunk prompts by category/phase.
- Security: store keys in env; no PHI handling rules required for MVP (subject to change).
- Observability: request ids across UI/backend; basic timing metrics in logs.

---

## 6) Milestones & Deliverables
1. Project setup (FastAPI, React, shared types, dirs); env/config scaffolding.
2. Rules parser (ADSL_ApplicationBehaviourRules + MacroLogic) → canonical JSON.
3. Spec upload + header detection + mapping UI.
4. Variable categorizer + pattern decoder + categorized view.
5. Provider abstraction (Gemini default) + prompt templates.
6. Orchestrated generation per MacroLogic; merge into SAS/R file; gated confirmations.
7. Static validation; warnings/errors panel; export.
8. Monaco editor integration; code diffs and download.
9. Persistence (outputs, sessions, logs) with timestamped paths.
10. Local run instructions and smoke test with sample spec.

---

## 7) Test Strategy
- Unit tests: rules parser, spec parser, variable categorizer, pattern decoder.
- Integration tests: prompt builder correctness for each phase; provider client error handling.
- E2E (manual for MVP): sample spec → full ADSL generation in SAS and R; verify coverage report; review code structure aligns with MacroLogic.
- Fixtures: anonymized sample spec; synthetic SDTM shapes metadata (no execution required).

---

## 8) Directory Structure & Conventions (MVP)
- Inputs: `Content\UserInputs\ADAMSpecifications\` (uploaded specs)
- Standards: `Content\StandardDocuments\` (IG version, dictionaries)
- Generated: `Content\Generated\ADSL\{timestamp}\{SAS|R}\ADSL.{sas|R}`
- Sessions: `Content\Sessions\{session_id}.json`
- Logs: `Content\Logs\{date}.log`
- Naming: use ISO timestamp `YYYYMMDD_HHMMSS` for generated folders.

---

## 9) Open Items & Future Enhancements
- Add IG-specific rules content and parser; enforce IG-based validations.
- Extend to ADAE, ADLB with dataset-specific rules and MacroLogic.
- RAG over `StandardDocuments` with semantic chunking to enrich prompts.
- Containerization and cloud deployment; secret management (e.g., AWS Secrets Manager).
- Optional: run-time code execution against sample SDTM (post-MVP) for deeper validation.

---

## 10) Risks & Mitigations
- Spec format variability → mapping UI and header autodetection.
- Token/length limits → phase-by-phase generation and summarization.
- Provider limits/errors → retry/backoff and resumable generation per phase.
- Static validation limits → clearly label checks as best-effort; encourage manual review.

---

## 11) Acceptance Criteria (MVP)
- User uploads ADSL spec; confirms column mapping.
- App categorizes variables and decodes families; highlights missing/unmatched.
- Guided, rule-driven flow collects confirmations per category.
- Generates coherent SAS and R programs in MacroLogic order.
- Validation panel reports coverage and basic issues; user can edit code.
- Final artifacts saved to timestamped folder and downloadable; session persisted.

---

## 12) Local Run (MVP) — High-Level
- Prereqs: Node.js and Python 3; set `GOOGLE_API_KEY` and `MODEL=gemini-2.5-pro` in env.
- Ensure folders exist (app will create if missing):
  - `Content\UserInputs\ADAMSpecifications\`
  - `Content\StandardDocuments\`
  - `Content\Generated\ADSL\` and `Content\Logs\` and `Content\Sessions\`
- Place sample spec in `Content\UserInputs\ADAMSpecifications\`.
- Start backend (FastAPI + uvicorn) and frontend (React) in local dev mode.

