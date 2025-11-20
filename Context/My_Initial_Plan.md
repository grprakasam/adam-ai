# ADAM AI – Navigation, Workspace & Submission Readiness Initial Implementation Plan (v1)

Status: Planning approved for drafting (no code changes)
Scope (extended):  
- Redesign the application information architecture with a **top horizontal main menu** and **grouped right-panel tabs** for:
  - **Code Generation** → Pair Programming, Consolidated Code, Traceability  
  - **Code Validation** → Code Validator, Test With SDTM Data  
  - **Submission Readiness** → Submission Readiness, My Validation  
- Introduce **global shell features** (Study selector, User Profile, Help, Settings; optional Admin-only items) without breaking existing "Setup / Datasets / Variables / Rules" left-panel behavior.  
- Keep and extend the existing **Submission Readiness** plan (p21 validation, Define.xml, ADRG/SDRG, eCTD) to fit into the new IA.  
- Deliver **UX/IA + API design (screens, states, endpoints, data models)** only – no implementation.

---

## 1) Agreed Scope & Assumptions

### 1.1 Overall product and architecture
- Follow **Context/ProjectArchitecture/ProjectArchitecture.md**, **ProjectRequirements.md**, and **TECH_STACK.md** as primary architectural constraints:
  - Domain-first ADaM code generation for ADSL/ADAE/ADLB etc.
  - Rule-driven behavior using `Context/ADAMRules/` (e.g., `ADSL_ApplicationBehaviourRules.md`, `ADAM_VariablenamingRules.md`, `ADSL_MacroLogic.md`).
  - Frontend: React + TypeScript + AntD; Backend: FastAPI + Pydantic; simple, intuitive, scalable, testable.
- Work is **additive and non-breaking**:
  - Keep existing **left panel tabs** (`Setup`, `Datasets`, `Variables`, `Rules`) as-is.
  - Keep existing **Pair Programming, My Validation, Consolidated Code, Code Validator, Test With Data, Traceability, Submission Readiness** functionality; only reorganize how they are accessed.
  - Avoid changing current generation/validation algorithms unless required for new UX, and even then only behind well-defined API/UI contracts.

### 1.2 Navigation & IA
- Introduce a **top horizontal navigation bar** (global shell) with main menu groups:
  1) **Code Generation**
  2) **Code Validation**
  3) **Submission Readiness**
  4) **Help**
  5) **User Profile**
  6) (Optional) **Settings** / **Admin** (role-based)
- Group existing right-panel "panels" into **separate tabs inside each main menu area**:
  - Code Generation: `Pair Programming`, `Consolidated Code`, `Traceability`  
  - Code Validation: `Code Validator`, `Test With SDTM Data`  
  - Submission Readiness: `Submission Readiness`, `My Validation`
- Ensure navigation is **consistent, minimal-click, and predictable** with clear "What's next?" at each step, in line with "Always ensure Simple yet Efficient" from the architecture docs.

### 1.3 Study / Project model and session behavior
- Treat **"Study" and "Project" as the same concept**; no multi-tenant org layer:
  - Use a single **Study selector** on the top bar to scope the entire workspace.
  - All session data (uploaded specifications, SDTM datasets, ADaM outputs, validation results) is **scoped per user + study**.
- After the user uploads the specification (per `ProjectRequirements.md` and `ADSL_ApplicationBehaviourRules.md`):
  - The system must infer the **ADaM dataset** to be created (e.g., ADSL).
  - Use the appropriate rules from `Context/ADAMRules/` to drive the UI flow (variable categorization, macro logic, naming rules) and downstream generation panels under **Code Generation**.

### 1.4 Submission Readiness scope (existing plan kept)
- Keep the existing **Submission Readiness** scope and assumptions, now nested under the new IA:
  - Regulatory focus: FDA; align with ADaM and submission expectations.
  - P21 CE integration: run via Docker; apply rule sets for ADaM only; no sponsor-specific checks.
  - Controlled Terminology: read from `Content/ControlledTerminology/ControlledTerminology.xlsx`; support MedDRA/NCI versions; default to latest.
  - Define.xml: ADaM-only, Define-XML 2.1, with sponsor placeholders (StudyName, ProtocolName, Originator, etc.).
  - ADRG/SDRG: generate from editable DOCX templates; ADaM-focused; no SDTM linkages in v1.
  - eCTD: FDA-style M5 structure for ADaM artifacts only.
  - Electronic signatures & audit trails: stubs/placeholders (no enforcement yet).
  - Artifacts & storage: simple on-disk layout per study (detailed in section 6).
  - Datasets in scope: all ADaM datasets the app can generate; define/ADRG/SDRG linkages limited to ADaM in v1.
  - Performance & security: keep simple, limit resource-intensive jobs, no PHI expected.

### 1.5 Admin, Help, and non-functional priorities
- **Admin Panel** (v1 focus):
  - **Audit log viewing/export**: surface key actions (study selection, uploads, code generation runs, validations) in a read-only admin UI.
  - **Template management** for prompts, validation rules, and submission templates (e.g., DOCX templates, LLM prompt templates).
- **Help Center / Tutorials / Release Notes / Feedback**:
  - Treated as **static pages** for v1 (e.g., markdown-driven or pre-defined content), not a full CMS.
- Non-functional priorities for this plan:
  1) **Performance and perceived responsiveness** (snappy navigation, incremental loading, clear progress indicators).
  2) **Consistency and simplicity of navigation** (fewer clicks, cohesive flow).
  3) **Multi-study robustness and isolation** (no cross-study leakage, clear context).

Constraints and guardrails
- No code execution in this planning phase; outputs must be **design and documentation only**.
- Use existing tech stack and patterns (React + TS + AntD + Zustand; FastAPI + Pydantic).
- Respect all behavior rules under `Context/ADAMRules/` (e.g., variable categorization based on `VariablesMapping.xlsx`, naming rules, macro logic) when designing flows.
- All changes must be **backwards-compatible** and gated so current users are not surprised (feature flags where appropriate).

---

## 2) UX Flow & IA (Information Architecture)

### 2.1 Global shell: top navigation & top bar

**Layout**
- Keep existing **two-panel** structure:
  - Left panel: `Setup`, `Datasets`, `Variables`, `Rules` (unchanged behavior).
  - Right panel: workspaces for code generation, validation, traceability, submission readiness.
- Add a **top horizontal navigation bar** across the page, above left/right panels, containing:
  - App logo + name ("ADAM AI") on the left.
  - Main menu items (center or left-aligned):
    - `Code Generation` (default active after study selection)
    - `Code Validation`
    - `Submission Readiness`
    - `Help`
  - Top-bar utilities (right‑aligned):
    - `Study Selector` (combo box; required before using workspaces)
    - `Notifications` (bell icon)
    - `Search` (icon opening global search)
    - `Dark Mode Toggle`
    - `Language Selector`
    - `User Profile` (avatar/name with dropdown: User Settings, Change Password, Theme Selector, Logout)
    - (If admin) `Admin` or `Admin Panel` badge/menu; `Audit Logs` entry.

**Behavior**
- **Study selector** is mandatory context:
  - When no study is selected, main workspaces are visually disabled and show a friendly prompt to "Select or create a study".
  - On study change, right-panel tabs refresh with study-scoped data (specs, datasets, generated code, validations).
- Menu selection determines **which group of right-panel tabs is visible**, but does not alter the left panel.

### 2.2 Code Generation – Right panel structure

**Tabs under Code Generation**
- `Pair Programming`  
- `Consolidated Code`  
- `Traceability`

**High-level flow**
1. User selects a **Study** and uploads specifications (per current flow under Setup/Datasets/Variables).  
2. `Pair Programming` acts as the conversational workspace where the domain-based LLM understands specs and ADAMRules, proposes code, and interacts with the user.  
3. `Consolidated Code` shows the stitched, study-scope ADaM program(s) per dataset, including variable derivations and macro logic (e.g., from `ADSL_MacroLogic.md`).  
4. `Traceability` provides mapping between specification rows, source SDTM variables, and ADaM derivations, leveraging `Context/ADAMRules/*` and existing traceability logic.

**UX principles**
- Clearly indicate at the top of the right panel:
  - Current Study, Dataset (e.g., ADSL), and progress (e.g., "Variables: 15/40 reviewed").
- Provide a guided "Next Step" banner at the top of each tab (e.g., from Pair Programming → Consolidated Code → Traceability).
- Reuse existing Monaco-based code editor views and validation summaries; do not regress features.

### 2.3 Code Validation – Right panel structure

**Tabs under Code Validation**
- `Code Validator`
- `Test With SDTM Data`

**Code Validator**
- Uses existing behavior to validate generated code (R/SAS) for syntax and basic CDISC rules.
- Displays issues in a structured table with filters and links back to code segments in `Consolidated Code` where possible.

**Test With SDTM Data**
- Reuse/extend existing "Test With Data" functionality, scoped per study:
  - Select SDTM dataset files associated with the current study.
  - Run generated ADaM programs against SDTM inputs.
  - Show results as:
    - Basic metrics (record counts, missingness, key violations).
    - Optionally, quick data samples or counts for key endpoints.
- Provide clear error messaging and performance feedback (progress spinners, status chips).

**Interactions**
- Allow quick switching between `Code Validator` and `Test With SDTM Data` while preserving context of selected study and dataset.
- Provide a "Re-run validation" button and show last-run timestamps per study/dataset.

### 2.4 Submission Readiness – Right panel structure

**Tabs under Submission Readiness**
- `Submission Readiness` (core new UI that hosts the p21/Define/eCTD flows)
- `My Validation`

**Submission Readiness tab – integrated sections**
- Reuse and extend the previous plan’s sections, now visually organized as:
  - **Study & Dataset Context** (read-only header, aligned with other groups).
  - **p21 Core Validation** (see 2.5).
  - **FDA Submission Package** (see 2.6).

**My Validation tab**
- User-centric view for **per-user validation runs** and notes:
  - Timeline/history of the user’s own p21/validation runs for the selected study.
  - Quick filters by severity, artifact type, or dataset.
  - Ability to mark items as "Reviewed", add short comments/annotations (stored per user + study).

### 2.5 Detailed UI sections for p21 Core Validation

- **Study & Dataset Context (read-only)**:
  - Show Study ID, dataset name, standards versions (ADaM IG, MedDRA), and spec upload status.
  - Provide a "Go to Setup" link that focuses the left panel where those can be adjusted.
- **Pre‑P21 Structural Checks**:
  - Button to run structural validation on selected ADaM dataset metadata:
    - Required variables and keys.
    - Label length constraints (e.g., ≤ 256 chars).
    - Date/datetime flags and formats per `ADAM_VariablenamingRules.md`.
    - Variable naming pattern checks (DT/DTM/FL/GRy/N, TRTxxP/TRTxxA, APxxSDT/APxxEDT, etc.).
- **Controlled Terminology Validation**:
  - Button to run CT checks using `Content/ControlledTerminology/ControlledTerminology.xlsx`:
    - MedDRA/NCI version dropdown (default: latest in file).
    - Display current CT file path; ability to switch to a different file (for future enhancement).
- **Pinnacle 21 CE Validation**:
  - Button to run P21 CE via Docker with ADaM ruleset.
  - Show progress indicator, current step, and estimated completion time if available.
- **Results area** with tabs:
  - **Summary**: pass/fail counts by severity and category; high-level recommendations.
  - **Issues**: filterable table (severity, dataset, variable, rule code, message, location).
  - **Artifacts**: links to raw P21 outputs and pre-check reports (per-study storage layout in section 6).
- UX principle: allow running Pre-P21/CT checks separately, and then P21 CE, without hard dependency ordering; show clearly which steps have been completed.

### 2.6 Detailed UI sections for FDA Submission Package

- **Study Metadata Card**:
  - Fields: Study Name, Protocol, Description, Sponsor, ADaM IG version, MedDRA version.
  - Non-intrusive helper text describing what will be included in Define.xml and ADRG/SDRG.
- **Define.xml (ADaM) Generator**:
  - "Generate" button with options:
    - Include stylesheet link (placeholder).
    - Include variable-level documentation.
    - Include value-level metadata (future extension).
    - Select which ADaM datasets to include.
  - After generation: show a "Preview" link and download option.
- **ADRG Generator (DOCX)**:
  - "Generate ADRG" button using a study-scoped DOCX template.
  - Content blocks: overview, datasets list, derivation summaries (if available), validation notes.
- **SDRG Generator (ADaM-focused)**:
  - "Generate SDRG" button using DOCX template.
  - Include table of datasets and associated documentation artifacts.
- **eCTD Packaging**:
  - Select target directory (per study).
  - Generate FDA M5-like structure with Define.xml, ADRG, SDRG, and selected program files.
  - Optionally zip the package.
- **Artifacts list**:
  - Show all generated artifacts (name, type, createdAt, study, size) with download and "open in folder" actions.

### 2.7 Help & User Profile menus

**Help menu (top bar)**
- Drop-down options (all static pages in v1):
  - `Help Center` – overview of how to use the app, with links to specific sections.
  - `Tutorials` – step-by-step guides for common flows (e.g., "Generate ADSL from SDTM", "Run Submission Readiness checks").
  - `Feedback` – form or link to external feedback channel.
  - `Release Notes` – static changelog, ideally driven by markdown files.

**User Profile menu**
- `User Settings` – basic preferences (e.g., default language, default dark/light mode, preferred LLM provider if allowed).
- `Change Password` – UI stub, wired to existing auth system when available.
- `Theme Selector` – select from predefined themes (e.g., default, high-contrast); in v1, could share logic with dark mode toggle.
- `Logout` – standard sign-out behavior; clear study/session context.

### 2.8 Admin Panel entry points

- If current user has admin role:
  - Show `Admin` or `Admin Panel` in top navigation or as a prominent item inside the User Profile menu.
  - Within Admin, expose:
    - `Audit Logs` view (see section 3).
    - `Template Management` (prompts/validation/submission templates).
  - Admin UI should be clearly separated from regular workflows; no accidental exposure.

---

## 3) Backend Design (APIs, models, and services)

> Note: No code execution or implementation; only design. Reuse FastAPI + Pydantic patterns already in `backend/app`.

### 3.1 Study and session scoping

**Models**
- `Study` (conceptual; may map to an existing model or config):
  - `id: str` (unique study identifier)
  - `name: str`
  - `description: Optional[str]`
  - `standard_versions: dict` (e.g., ADaM IG, MedDRA)
  - `created_at: datetime`
  - `created_by: str`
- `UserStudyContext`:
  - `user_id: str`
  - `study_id: str`
  - `last_active_panel: Literal["code_generation","code_validation","submission_readiness"]`
  - `last_active_tab: str` (e.g., "pair_programming", "code_validator")

**Endpoints (examples)**
- `GET /api/v1/studies` → list studies accessible to the user.
- `POST /api/v1/studies` → create a new study (optional in v1 if not already present).
- `GET /api/v1/studies/{study_id}` → get study details/config.
- `POST /api/v1/studies/{study_id}/select` → set user’s active study context.

### 3.2 Navigation state & panel configuration

Backend should provide **navigation metadata** to minimize frontend hard-coding and keep IA configurable:

**Model: `MenuConfig`**
- `id: Literal["code_generation","code_validation","submission_readiness"]`
- `label: str`
- `icon: str` (e.g., icon name from a canonical set)
- `tabs: List[MenuTab]`

**Model: `MenuTab`**
- `id: str` (e.g., "pair_programming")
- `label: str`
- `icon: str`
- `route: str` (internal route/identifier; not necessarily a URL)
- `requires_study: bool`

**Endpoint**
- `GET /api/v1/ui/menu` → returns `List[MenuConfig]`, allowing the frontend to render the grouped right-panel tabs and main menu structure dynamically.

### 3.3 Submission Readiness backend (existing plan, refined)

Reuse and expand the prior Submission Readiness backend design with clear, typed interfaces:

**Models**
- `Issue`:
  - `severity: Literal["ERROR","WARNING","INFO"]`
  - `dataset: Optional[str]`
  - `variable: Optional[str]`
  - `rule_id: Optional[str]`
  - `message: str`
  - `location: Optional[str]`
  - `category: Optional[str]`
- `ArtifactRef`:
  - `name: str`
  - `path: str`
  - `created_at: datetime`
  - `checksum: Optional[str]`
- `P21RunRequest`:
  - `study_id: str`
  - `datasets: List[str]` (ADaM datasets to validate)
  - `ct_version: Optional[str]`
- `P21RunResult`:
  - `issues: List[Issue]`
  - `artifacts: List[ArtifactRef]`
  - `summary: dict` (counts by severity, etc.)
- `DefineXmlRequest`:
  - `study_id: str`
  - `datasets: List[str]`
  - `include_variable_level: bool`
  - `include_value_level: bool`
  - `stylesheet_url: Optional[str]`
- `DefineXmlResponse`:
  - `artifact: ArtifactRef`
- `SubmissionPackageRequest`:
  - `study_id: str`
  - `include: { "define_xml": bool, "adrg": bool, "sdrg": bool, "programs": Optional[bool] }`
  - `zip: Optional[bool]`
- `SubmissionPackageResponse`:
  - `artifact: ArtifactRef`
  - `tree: List[str]` (relative paths)

**Endpoints**
- `POST /api/v1/submission/{study_id}/precheck` → run Pre‑P21 structural checks.
- `POST /api/v1/submission/{study_id}/ct-check` → run CT validations.
- `POST /api/v1/submission/{study_id}/p21` → run P21 CE with ADaM rule set.
- `POST /api/v1/submission/{study_id}/define-xml` → generate Define.xml.
- `POST /api/v1/submission/{study_id}/adrg` → generate ADRG DOCX.
- `POST /api/v1/submission/{study_id}/sdrg` → generate SDRG DOCX.
- `POST /api/v1/submission/{study_id}/package` → generate eCTD-style package.
- `GET /api/v1/submission/{study_id}/artifacts` → list existing artifacts.

### 3.4 My Validation and user-centric views

**Model: `ValidationRun`**
- `id: str`
- `study_id: str`
- `user_id: str`
- `type: Literal["precheck","ct","p21"]`
- `started_at: datetime`
- `completed_at: Optional[datetime]`
- `status: Literal["pending","running","completed","failed"]`
- `summary: dict`

**Endpoints**
- `GET /api/v1/validations/{study_id}/mine` → list `ValidationRun` for current user.
- `GET /api/v1/validations/{run_id}` → details of a run (including issues and artifacts).

### 3.5 Admin – audit logs & template management

**Audit Logs**
- Model: `AuditLogEntry`:
  - `id: str`
  - `timestamp: datetime`
  - `user_id: str`
  - `study_id: Optional[str]`
  - `action: str` (e.g., "UPLOAD_SPEC", "RUN_P21", "GENERATE_DEFINE_XML")
  - `details: dict` (payload summary).
- Endpoints (admin-only):
  - `GET /api/v1/admin/audit-logs` with filters (user, study, action, date range).
  - `GET /api/v1/admin/audit-logs/export` → CSV export.

**Template Management**
- Templates categories: `PROMPT`, `VALIDATION_RULE`, `SUBMISSION_DOCX`.
- Model: `Template`:
  - `id: str`
  - `name: str`
  - `category: str`
  - `study_scoped: bool`
  - `content_ref: ArtifactRef` or inline content for small templates.
- Endpoints (admin-only):
  - `GET /api/v1/admin/templates`
  - `POST /api/v1/admin/templates`
  - `PUT /api/v1/admin/templates/{template_id}`
  - `DELETE /api/v1/admin/templates/{template_id}`

### 3.6 Help & static content

- Serve static markdown or HTML for Help Center, Tutorials, Release Notes, and Feedback instructions.
- Endpoints:
  - `GET /api/v1/help/pages` → list of available help pages.
  - `GET /api/v1/help/pages/{slug}` → page content.

### 3.7 Performance and responsiveness

- Design endpoints to support:
  - Pagination for issues/artifacts and audit logs.
  - Asynchronous, cancellable long-running operations (P21 runs, package generation) with status polling endpoints.
  - Study-scoped caching for frequently accessed metadata (e.g., CT file, rules).

---

## 6) Data, Files & Conventions

- Controlled Terminology Excel: `Content/ControlledTerminology/ControlledTerminology.xlsx`
  - Expected sheets: `Codelists`, optionally one sheet per codelist (simple v1: single table with columns: `Codelist`, `Code`, `Decode`, `Version`, `Standard`).
- Study input/config: reuse existing project configuration; extend as needed for sponsor placeholders.
- Artifacts storage (Submission Readiness): `Content/Submissions/<StudyId>/...` as detailed above.
- Audit logs: stored in database (preferred) or log files with a thin index layer; design to support efficient filtering by study/user/action.
- Templates: stored either as files under `Content/Templates/...` or in DB with metadata; design for clear categories (prompts, validation, submission).
- Limits: max ADaM files per run (e.g., 20), max file size (e.g., 200MB per dataset) – simple, configurable.

---

## 7) Non-Breaking Strategy & Feature Flagging

- Additive routes and components only; no changes to existing flows/components other than registering new tabs and main menu.
- Guard the new navigation and Submission Readiness area with feature flags, e.g.:
  - `enableNewMainMenu`
  - `enableSubmissionReadiness`
  - `enableAdminPanel`
  - `enableHelpPages`
  - Defaults: enabled in dev; controlled via config in higher environments.
- Lazy load tabs and heavy panels to avoid bundle bloat/latency for users who don’t use them.
- Backend endpoints are new; no changes to existing endpoints.

---

## 8) Test Strategy

Unit tests (backend)
- `adam_conformance.py`: required variables, label length, naming checks.
- `controlled_terminology.py`: CT loader, sheet parsing, value checks.
- `define_xml_generator.py`: minimal ADaM ODM structure rendered; XML well-formedness.
- `ectd_packager.py`: correct folder tree and manifest generation.

Unit tests (navigation & context)
- Test backend `MenuConfig` shape and alignment with roles and feature flags.
- Test study context endpoints and that all Submission Readiness and validation endpoints require a valid study context.

Unit tests (admin & help)
- Template management CRUD operations.
- Audit log filtering and export.
- Help page loading (e.g., from markdown).

Integration tests
- Stub a minimal ADaM dataset and run Pre-P21 + CT.
- Stub P21 outputs (CSV/XML) to validate parser without running Docker in CI.
- End-to-end: generate Define.xml + ADRG/SDRG from sample inputs and package eCTD to a temp directory.

Frontend tests
- Verify that:
  - Main menu toggles the correct group of right-panel tabs.
  - Study selector gating works (no actions allowed without an active study).
  - Submission Readiness tabs and My Validation views behave as expected.
- Component tests for top bar utilities (help menu, profile menu, notifications icon behavior at least in stub form).

---

## 9) Delivery Plan (Phased)

Phase 0 – IA & Navigation Scaffolding (0.5–1 week)  
- Design and document `MenuConfig`, `MenuTab`, and study context models and endpoints.  
- Implement (later) top bar layout and main menu groups with stubbed right-panel tabs (no behavioral changes).  
- Introduce feature flags and ensure old behavior can be restored quickly.

Phase 1 – Code Generation & Code Validation Tab Grouping (0.5–1 week)  
- Wire existing `Pair Programming`, `Consolidated Code`, `Traceability`, `Code Validator`, and `Test With SDTM Data` into the new grouped right-panel tabs.  
- Ensure no functionality is lost; only entry points change.  
- Add navigation breadcrumbs and “Next Step” hints for these flows.

Phase 2 – Submission Readiness Shell (0.5 week)  
- Integrate existing Submission Readiness plan into the new `Submission Readiness` tab and `My Validation` tab skeletons.  
- Provide basic layout and static sections for p21 Core Validation and FDA Submission Package.

Phase 3 – Submission Readiness Backend APIs (1–1.5 weeks)  
- Implement (later) Pre‑P21, CT, P21, Define.xml, ADRG/SDRG, and packaging endpoints as per section 3.3.  
- Implement `ValidationRun` and `ArtifactRef` models and persistence.  
- Wire My Validation tab to these endpoints.

Phase 4 – Admin Panel (Audit Logs & Templates) (1 week)  
- Design and then implement (later) admin-only endpoints for audit logs and template management.  
- Create admin UI skeleton for viewing logs and managing templates.

Phase 5 – Help, Tutorials, Release Notes, Feedback (0.5 week)  
- Add static help pages, tutorials, release notes, and feedback entry point; wire to Help menu.  
- Ensure content is discoverable and contextual (links from relevant panels).

Phase 6 – Performance, Polish & QA (0.5–1 week)  
- Optimize perceived responsiveness (loading indicators, debounce for search, lazy loading for heavy panels).  
- Conduct smoke tests to ensure no regressions in existing flows.  
- Refine layout and microcopy based on internal feedback; adjust feature flags for rollout.
