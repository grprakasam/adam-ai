# ADAM Generator Feature – Initial Implementation Plan

## 1. Objectives and Constraints

- Build a new **ADAM Generator** section that:
  - Uses SDTM datasets produced by the existing **SDTM Generator**.
  - Uses the **Consolidated Code** (R-focused, but compatible with R/SAS) from the existing **Code Generation / Consolidated Code** flow.
  - Executes R programs inside the app using **Dockerized R runtimes**.
  - Produces **ADAM datasets** (e.g., ADSL, ADAE, ADLB) as downloadable tables (CSV/XLSX/ZIP).
  - Supports **study-centric workflows** (everything scoped by study name / study_id).
  - Collects **audit logs** and **user feedback** for each run.
- Preserve and reuse:
  - Existing SDTM Generator, Pair Programming, Consolidated Code, and code-generation backend modules.
  - Existing UX patterns: card-based layouts, progress modals, SSE streaming, and Ant Design styling.
- Constraints:
  - No breaking changes to current UI/UX or APIs.
  - R code must run **sandboxed in Docker containers** with timeouts and resource limits.
  - Design must be simple, intuitive, and domain-centric for ADAM programmers.

---

## 2. High-Level User Journey

1. **Study Selection (Global Context)**
   - User selects a **Study Name/ID** at the top-level (or in Setup tab).
   - Selected study becomes the context key for:
     - Uploaded specifications.
     - Generated SDTM datasets.
     - Generated consolidated ADAM code.
     - ADAM dataset generation runs and logs.

2. **Specification & SDTM Generation (Existing Flow)**
   - User uploads ADAM specification Excel into `Content/UserInputs/ADAMSpecifications/`.
   - The existing flow:
     - Parses specifications.
     - Applies rules from `Context/ADAMRules/*`.
     - Generates variable-level snippets via Pair Programming/Code Generation.
     - Generates SDTM test datasets via SDTM Generator (already enhanced per `IMPLEMENTATION_SUMMARY.md`).

3. **Consolidated ADAM Code (Existing Flow)**
   - User uses the Pair Programming area + Consolidated Code tab to:
     - Approve variable snippets.
     - Generate **Consolidated ADAM program** (primarily R for this feature) for a selected ADAM dataset (e.g., ADSL).
     - Download/inspect the consolidated code.

4. **ADAM Generator (New Section)**
   - User navigates to the new **ADAM Generator** section.
   - Side panel:
     - Shows **Study**, **Target ADAM dataset**, **R version**, **input SDTM datasets** selection, and an **R editor** pre-filled with the consolidated code for that dataset.
   - Main panel:
     - Shows status, logs, and the **Generate ADAM Datasets** button.
     - On trigger:
       - Backend launches a Dockerized R runtime.
       - R script reads SDTM inputs and executes the consolidated code.
       - Outputs ADAM dataset(s) into known file paths.
     - Once finished:
       - ADAM datasets are displayed in tables.
       - Download buttons for CSV/XLSX/ZIP are available.
       - User can submit feedback via an in-page feedback form.

5. **Audit, Reproducibility, and Feedback**
   - Each ADAM generation run is stored as a **Run record**:
     - Study ID, dataset, R version, code hash, SDTM dataset versions, timestamps, run status.
   - Logs written via `loguru` and optionally persisted as structured JSON/DB records.
   - Feedback entries are stored and linked to run IDs for future analysis.

---

## 3. Domain Model and Data Layout

### 3.1 Core Concepts

- **Study** (`study_id` / `study_name`)
  - Logical key across the app; chosen early in the workflow.
  - All assets (specifications, SDTM datasets, generated code, ADAM datasets, logs) are scoped by study.

- **SDTM Dataset Artifact**
  - Domain (e.g., DM, EX, DS, LB, AE).
  - Storage location (e.g., CSV/Parquet).
  - Generation metadata (generator version, timestamp).
  - Scoped by (`study_id`, `domain`).

- **Consolidated ADAM Program**
  - Generated R (or SAS) code for a specific ADAM dataset (e.g., ADSL).
  - Has:
    - Target ADAM dataset name.
    - Programming language.
    - Code text.
    - Generation metadata (LLM provider/model, code-generation version).
  - Persisted or re-fetchable from backend based on run ID / study ID.

- **ADAM Generation Run**
  - Represents one execution of consolidated code against SDTM datasets in an R Docker container.
  - Fields:
    - `run_id` (UUID).
    - `study_id`.
    - `adam_dataset` (e.g., ADSL).
    - `language` (R; SAS might be future).
    - `r_version` (e.g., 4.3.2).
    - Input SDTM datasets (names + paths).
    - Input code hash + stored code snapshot.
    - Start/end timestamps.
    - Status: `queued | running | succeeded | failed | canceled`.
    - Error summary (if failed).
    - Output artifact references (paths + formats).

- **ADAM Dataset Artifact**
  - References a generated ADAM dataset.
  - Fields:
    - `study_id`, `adam_dataset`, `run_id`.
    - File paths for CSV/XLSX/ZIP.
    - Row/column counts and basic statistics.
    - Optional schema metadata.

- **Feedback Entry**
  - Fields:
    - `run_id`, `study_id`, `adam_dataset`.
    - User ID or session identifier (if available).
    - Free-text feedback.
    - Optional rating and structured fields (e.g., correctness, clarity, completeness).
    - Timestamp.

### 3.2 Proposed File/Folder Layout

Align with existing `Content` and `Context` conventions while keeping everything scoped by study:

```text
Content/
  UserInputs/
    ADAMSpecifications/
      {study_id}/
        spec_{adam_dataset}.xlsx
  Generated/
    SDTM/
      {study_id}/
        {domain}.csv           # Existing SDTM generator outputs (DM, EX, DS, etc.)
    ADAM/
      {study_id}/
        runs/
          {run_id}/
            input/
              sdtm_*.csv       # Copies/symlinks of SDTM inputs used
              program.R         # Snapshot of consolidated R code
            output/
              {adam_dataset}.csv
              {adam_dataset}.xlsx
              adam_outputs.zip  # Optional bundled archive
            logs/
              run.log           # R/Docker logs
```

Exact path names can be refined during implementation but should follow this study-centric structure.

---

## 4. Backend Design – ADAM Generator and Dockerized R

### 4.1 New Backend Module Structure

Create a dedicated module under `backend/app/modules` following existing patterns:

```text
backend/app/modules/adam_generation/
  __init__.py
  schemas.py          # Pydantic models for API I/O
  service.py          # High-level orchestration logic
  runner.py           # Docker + R runtime execution
  repository.py       # Persistence helpers for run metadata and artifacts
  exceptions.py       # Domain-specific exceptions
```

Key responsibilities:

- `schemas.py`
  - `AdamGenerationRequest` (API input).
  - `AdamGenerationStatus` (status polling output).
  - `AdamDatasetPreview` (subset of ADAM dataset for UI table).
  - `AdamGenerationResult` (full result + download URLs).
  - `AdamFeedbackRequest` (feedback submission).
  - `RVersionInfo` (available R versions).

- `service.py`
  - Validate request (study exists, SDTM datasets available, code present).
  - Materialize a working directory under `Content/Generated/ADAM/{study_id}/runs/{run_id}`.
  - Write `program.R` and copy/link SDTM inputs into `input/`.
  - Call `runner.py` to execute R in Docker.
  - Parse outputs (CSV/XLSX) from `output/`.
  - Persist run metadata via `repository.py`.
  - Build responses for API (status, previews, download tokens).

- `runner.py`
  - Encapsulate all Docker interactions.
  - Accepts:
    - `work_dir`, `r_version`, timeout, resource limits.
    - Optional additional env vars (e.g., locale, numeric options).
  - Builds command:
    - Image name pattern: `RUNTIME_R_IMAGE_PREFIX` + `r_version` (configurable).
    - Command example:
      - `Rscript /work/program.R` or a small wrapper script `entrypoint.R` that manages input/output.
  - Enforces:
    - CPU and memory limits.
    - No outbound network (if feasible via Docker flags).
    - Read-only mounts for host directories except `output/`.
  - Collects logs to `logs/run.log`.
  - Returns:
    - Exit code.
    - STDERR/STDOUT (for error messaging and audit).
    - Execution timing metrics.

- `repository.py`
  - For initial implementation, use the filesystem plus, optionally, a small JSON index file per study.
  - Responsibilities:
    - Create and list `AdamGenerationRun` records.
    - Associate output artifacts (CSV/XLSX/ZIP) with runs.
    - Persist feedback entries.
  - Later, can be adapted to relational DB (RDS) without changing the API contracts.

- `exceptions.py`
  - Domain-specific exceptions:
    - `AdamInputsNotFoundError` (missing SDTM).
    - `AdamCodeMissingError` (no consolidated code for requested dataset).
    - `AdamRunTimeoutError`.
    - `AdamDockerExecutionError`.
  - Map these to appropriate HTTP error responses in the API layer.

### 4.2 Configuration and Environment

Extend `backend/app/config.py` and `.env`:

- New env vars:
  - `ADAM_R_DOCKER_IMAGE_PREFIX` (e.g., `rocker/r-ver:` or an internal image namespace).
  - `ADAM_R_DEFAULT_VERSION` (e.g., `4.3.2`).
  - `ADAM_R_ALLOWED_VERSIONS` (comma-separated list, e.g., `4.1.3,4.2.3,4.3.2`).
  - `ADAM_R_RUN_TIMEOUT_SECONDS` (e.g., `600`).
  - `ADAM_R_CPU_LIMIT` and `ADAM_R_MEMORY_LIMIT` (optional).
  - `ADAM_R_DOCKER_NETWORK_MODE` (e.g., `none` or restricted).
  - `ADAM_GENERATION_ROOT` (base path; default `Content/Generated/ADAM`).

Config behaviors:

- Provide a helper in `config.py` to parse `ADAM_R_ALLOWED_VERSIONS` into a validated set.
- Expose a service function to list available R versions for the frontend.
- Enforce that requested `r_version` is in the allowed list; fall back to default if omitted.

### 4.3 API Endpoints

Under `backend/app/api/v1/` create a new router module, e.g., `adam_generation.py`, and include it in the main API router:

1. **Start ADAM Generation**

```http
POST /api/v1/adam-generation/run
Content-Type: application/json
```

Request body (`AdamGenerationRequest`):

- `study_id`: string (required).
- `adam_dataset`: string (e.g., "ADSL") (required).
- `language`: `"R"` (for this feature; `"SAS"` reserved).
- `r_version`: optional string, must be allowed.
- `sdtm_domains`: optional list (defaults to required subset for dataset).
- `use_latest_sdtm`: boolean (default `true`).
- `consolidated_code_id`: optional reference to stored code.
- `consolidated_code_text`: optional raw code (if not using ID).
- `output_formats`: list of `"csv" | "xlsx" | "zip"` (with defaults).

Response:

- `run_id`, initial status (`queued | running`), estimated completion time, any immediate validation warnings.

2. **Poll Run Status**

```http
GET /api/v1/adam-generation/run/{run_id}
```

Response (`AdamGenerationStatus`):

- `run_id`, `study_id`, `adam_dataset`.
- `status`, `progress_percent`, `started_at`, `finished_at`.
- Human-readable `current_step` (mirroring frontend progress steps).
- If `succeeded`: preview metadata (row/column counts, formats available).
- If `failed`: error code + user-friendly error message.

3. **Download Generated ADAM Dataset**

```http
GET /api/v1/adam-generation/run/{run_id}/download?format=csv
```

Behavior:

- Validates that run succeeded and requested format is available.
- Streams file as attachment with sensible filename pattern:
  - `{study_id}_{adam_dataset}_{run_id}.{ext}`.

4. **List Available R Versions**

```http
GET /api/v1/adam-generation/r-versions
```

Response:

- Array of `RVersionInfo` objects with version string and optional description/notes.

5. **Submit Feedback**

```http
POST /api/v1/adam-generation/run/{run_id}/feedback
```

Request (`AdamFeedbackRequest`):

- `study_id`, `adam_dataset`, `rating` (optional numeric), `comments` (string), optional structured fields.

Response:

- Simple confirmation with echo of stored feedback ID.

### 4.4 R Program Execution Contract

To keep execution predictable and simple:

- Backend wrapper script (either generated or templated) ensures:
  - Required SDTM datasets are read into known R objects (e.g., `dm`, `ex`, `ae`, `lb`, `ds`).
  - Consolidated code is executed in an environment where:
    - Working directory = `/work` (mapped from `work_dir`).
    - SDTM inputs are available as CSV or RDS.
  - ADAM dataset is written to:
    - `/work/output/{adam_dataset}.csv`.
    - Optionally, `/work/output/{adam_dataset}.xlsx` using an R package.

Implementation approach:

1. Generate an R wrapper such as:
   - `00_inputs.R` – reads all SDTM input files into data frames.
   - `01_user_program.R` – contains the consolidated code.
   - `99_outputs.R` – writes out resulting ADAM data frame(s) to CSV/XLSX.
2. `program.R` sources these scripts in order.
3. Docker runs `Rscript /work/program.R`.

Error Handling:

- If any `stop()`/error occurs, ensure R exits with non-zero status.
- Capture error messages in STDERR and map them into a concise user-facing message, while retaining full logs in `logs/run.log`.

### 4.5 Logging and Audit Trail

- Use `loguru` to log:
  - Run start and end with `run_id`, `study_id`, `adam_dataset`, `r_version`.
  - Paths of input SDTM datasets and output artifacts.
  - Docker image used and resource limits.
  - Duration and success/failure status.
  - High-level error classifications (timeout, R runtime error, Docker error, missing inputs).
- Persist a summarized JSON metadata file per run in the run directory to support:
  - Future inspection.
  - Re-run using the same inputs.
  - Simple internal reporting without immediately requiring DB changes.

---

## 5. Frontend Design – ADAM Generator Section

### 5.1 Navigation and Entry Points

**New top-level section / tab:**

- Add an **"ADAM Generator"** entry to the existing navigation (consistent with how SDTM Generator and Pair Programming are exposed).
- When the user clicks it:
  - Use the currently selected `study_id` (from Setup or a global selector).
  - If no study is selected, guide the user to choose one first.

**Deep links from existing flows:**

- From **Consolidated Code**:
  - Add a button, e.g., **"Open in ADAM Generator"**, on the consolidated code screen.
  - Clicking it routes to ADAM Generator with pre-filled:
    - `study_id`.
    - `adam_dataset`.
    - `consolidated_code_id` or code text.
    - Preferred language = `"R"`.
- From **SDTM Generator**:
  - Add a button like **"Use these SDTM datasets in ADAM Generator"** after successful SDTM generation for a study.
  - Pre-populates ADAM Generator with latest SDTM outputs for that study.

### 5.2 Layout and Components

Following the Pair Programming / card-based design documented in `VISUAL_TRANSFORMATION_SUMMARY.md`:

- **Left Panel (Configuration + R Editor)**
  - Panels:
    - Study Context:
      - Read-only display of current `study_id`.
      - Dropdown to switch study (with warning about context switch).
    - ADAM Dataset Selection:
      - Dropdown for target ADAM dataset (e.g., ADSL, ADAE, ADLB).
      - Dynamic helper text referencing ADAMRules and expected SDTM domains.
    - SDTM Inputs:
      - Multi-select list of available SDTM domains for this study (e.g., DM, EX, DS).
      - Show whether they are present (green check) or missing (warning).
    - R Runtime:
      - Dropdown for R version (populated from `/api/v1/adam-generation/r-versions`).
      - Badge showing default recommended version.
    - R Editor:
      - Monaco-based editor (reuse existing code editor component).
      - Pre-filled with consolidated code when arriving via deep link.
      - Provide "Reset to latest consolidated code" / "Download current program" buttons.
      - Provide "Download modified code" (R script) as `.R` file as requested.

- **Right Panel (Run, Progress, Output, Feedback)**
  - Header:
    - Title: "ADAM Dataset Generator".
    - Subtext describing the flow: "Run your consolidated R program against SDTM inputs to generate ADAM datasets."
  - Primary Action:
    - **"Generate ADAM Datasets"** button.
    - Disabled until:
      - Study is selected.
      - ADAM dataset selected.
      - Required SDTM domains are available/selected.
      - Editor content is non-empty.
  - Progress & Status:
    - Use an Ant Design modal / drawer similar to Consolidated Code progress:
      - Show steps:
        - Validating inputs.
        - Preparing Docker environment.
        - Copying SDTM inputs.
        - Executing R program.
        - Parsing ADAM outputs.
        - Finalizing artifacts and logs.
      - Live progress bar (%).
      - Elapsed time.
      - Streaming messages (polling or SSE).
  - Result View:
    - Upon success:
      - Tabular preview of generated ADAM dataset:
        - Paginated Ant Design table.
        - Show row count, variable count, key variables (USUBJID, treatment variables, flags).
      - Download Options:
        - Buttons: "Download CSV", "Download XLSX", "Download ZIP".
        - Use backend download endpoint with appropriate format param.
      - Run metadata summary card:
        - R version, runtime duration, inputs used, code hash.
    - Upon failure:
      - Friendly error message with:
        - Short explanation (e.g., "R runtime error", "Missing SDTM datasets").
        - Suggested troubleshooting steps.
      - "View detailed logs" link (download or in-modal view of key log lines).

### 5.3 Feedback Form UI

- Place a **"Provide Feedback"** card below the result table:
  - Fields:
    - Likert-scale rating (e.g., 1–5) or simple "Meets expectations? Yes/No".
    - Free text "What should be improved?".
    - Optional toggle: "Dataset is production-ready" vs "Needs manual fixes".
  - On submit:
    - Call `/api/v1/adam-generation/run/{run_id}/feedback`.
    - Show success toast and clear the form.
  - Ensure feedback is only enabled once a run has completed (success or failure).

### 5.4 State Management and Integration

- Use existing global store (likely Zustand-based) patterns:
  - Add `adamGenerationStore` slice for:
    - Current `run_id`.
    - Status/progress.
    - Last result preview.
    - Last used configuration (dataset, R version, inputs).
  - Ensure study context is shared with other areas (Setup, SDTM Generator, Pair Programming).
- Navigation:
  - Implement routes and tab selection consistent with current `App.tsx` / layout.
  - Preserve ability to return to Pair Programming / SDTM Generator without losing ADAM Generator state for the current study.

---

## 6. Error Handling, Resilience, and Security

### 6.1 Error Categories and Handling Strategy

- **Validation Errors (Frontend/Backend)**
  - Example: missing SDTM datasets, unsupported R version, empty code.
  - Surface as validation messages in the UI before starting a run wherever possible.

- **Docker / Infrastructure Errors**
  - Example: Docker daemon unavailable, image not found.
  - Map to a clear user message: "Server-side runtime issue – please contact support" while logging detailed technical info.

- **R Runtime Errors**
  - Syntax errors, missing packages, failed joins, etc.
  - Show high-level summary and optional snippet of the R error.
  - Encourage user to adjust code and re-run.

- **Timeouts**
  - If run exceeds `ADAM_R_RUN_TIMEOUT_SECONDS`, kill container, mark run as failed with timeout error.
  - Suggest narrowing dataset or optimizing code.

### 6.2 Security and Isolation

- Run R code only in Docker containers with:
  - No outbound network by default (`--network=none` or equivalent).
  - Limited CPU and RAM.
  - Mounted work directory only; no access to the rest of the filesystem.
- Validate and sanitize all path handling to avoid directory traversal.
- Ensure logs never contain sensitive data such as API keys.
- Apply existing authentication/authorization (JWT) to new endpoints with the same protection level as other code-generation APIs.
- Rate limit ADAM generation endpoint (if rate limiting framework exists) to prevent abuse.

---

## 7. Testing Strategy

### 7.1 Backend Tests

- **Unit Tests**
  - `runner.py`:
    - Validate Docker command construction for different R versions and resource limits.
    - Simulate process return codes and ensure proper exception mapping.
  - `service.py`:
    - Validation of input combinations (study/dataset/code presence).
    - Handling of missing SDTM datasets.
    - Correct creation of working directories and file layouts.
  - `repository.py`:
    - Run metadata read/write.
    - Feedback persistence.

- **Integration Tests (Non-Docker or Docker-Mocked)**
  - Use a test double for Docker to avoid heavy dependencies in normal CI.
  - Simulate:
    - Successful R run producing a small CSV.
    - R error exit code.
    - Timeout behavior.
  - Test API endpoints:
    - `POST /adam-generation/run` -> queued/running status.
    - `GET /run/{run_id}` -> status transitions.
    - `GET /download` -> file streaming.
    - `POST /run/{run_id}/feedback`.

- **Optional End-to-End (Manual / Staging)**
  - Wire real Docker + R image on a staging environment.
  - Use small SDTM sample data and simple ADAM programs to validate the full flow.

### 7.2 Frontend Tests

- **Component-Level**
  - ADAM Generator layout renders correctly for:
    - No study selected.
    - Study selected but missing SDTM inputs.
    - Fully configured scenario.
  - Generate button:
    - Disabled/enabled conditions.
  - Progress modal:
    - Displays correct step progression based on mocked status responses.
  - Result table:
    - Renders preview rows and columns from a sample payload.
  - Feedback form:
    - Only enabled when a run is present.
    - Correctly calls feedback API and handles responses.

- **Integration / UX Tests**
  - Navigate from Pair Programming / Consolidated Code to ADAM Generator with prefilled state.
  - Adjust consolidated code, click Generate, and ensure that (via mocks) the round trip is smooth and existing screens remain unaffected.

---

## 8. Risk Assessment and Mitigation

### 8.1 Key Risks

- **R Runtime Complexity**
  - Risk: Docker + R introduces operational complexity and potential failures.
  - Mitigation:
    - Keep runtime isolated in a single module (`runner.py`).
    - Provide clear health checks and logs.
    - Start with a limited set of supported R versions.

- **Performance and Scalability**
  - Risk: Large SDTM datasets or complex R code could lead to long runtimes.
  - Mitigation:
    - Enforce timeouts and resource limits.
    - Encourage users to test on smaller subsets first.
    - Future: integrate queueing system (Redis/Celery) if usage grows.

- **Data Integrity**
  - Risk: Incorrect SDTM inputs or wrong dataset mappings could produce incorrect ADAM outputs.
  - Mitigation:
    - Use naming conventions and configuration to map required SDTM domains per target ADAM dataset.
    - Optionally, add pre-run sanity checks (e.g., check key columns like USUBJID).

- **User Confusion**
  - Risk: Users may not fully understand when to use ADAM Generator vs existing flows.
  - Mitigation:
    - Clear contextual guidance text on ADAM Generator page.
    - Explanatory tooltips and inline descriptions referencing domain concepts.
    - Consistent naming and flows aligned with `ProjectArchitecture` docs.

- **Breaking Existing Features**
  - Risk: Changes to shared components (e.g., study selector, routing, editors) might affect existing flows.
  - Mitigation:
    - Use additive changes, not breaking existing props/contracts.
    - Regression test existing flows (Pair Programming, SDTM Generator, Consolidated Code).

---

## 9. Open Questions and Missing Information

To refine this plan and avoid incorrect assumptions, the following clarifications are needed:

1. **Exact SDTM Generator Output Format**
   - Where are SDTM datasets currently stored (path, format – CSV/Parquet/RDS)?
   - Is there a stable API to query available SDTM datasets per study, or do we need to introduce one?

2. **Consolidated Code Persistence**
   - Is consolidated ADAM code already persisted server-side with IDs, or only present in the frontend?
   - Should ADAM Generator always fetch the latest server-stored version, or rely on code passed from the frontend?

3. **Authentication and Multi-User Context**
   - Are multiple users working on the same study concurrently?
   - Should feedback and run records be associated with user identities (and how are users represented today)?

4. **Initial R Image Strategy**
   - Do we have a preferred base R image (e.g., rocker project) and any required packages pre-installed?
   - Should we pre-build one "blessed" image per R version with common ADAM packages (e.g., `haven`, `dplyr`, `admiral`)?

5. **Volume of Data and Performance Expectations**
   - Typical SDTM dataset sizes (rows/columns)?
   - Acceptable time range for ADAM generation runs (e.g., under 5/10 minutes)?

6. **Feedback Data Usage**
   - How will feedback be used (internal review, model improvement, audit)?
   - Any regulatory or privacy constraints on free-text feedback that should influence storage location and retention?

7. **Study Identifier Canonicalization**
   - Should `study_id` follow any specific format (e.g., `PROJ001-STUDY01`)?
   - Do we need a dedicated backend model for Studies (with metadata), or is a plain string sufficient for now?

8. **Future SAS Support**
   - Should we architect the R runner to be language-agnostic (so we can add SAS containers later)?
   - Are there any plans to support hybrid workflows where R and SAS are both executed for the same study?

Once these questions are clarified, we can refine:

- The exact API signatures.
- The file/path conventions.
- The set of validations and UX affordances specific to your environment and regulatory needs.

---

## 10. Next Steps

1. Validate and refine this plan based on answers to the open questions above.
2. Finalize API contracts and configuration settings in `config.py` and `.env`.
3. Implement backend module `app/modules/adam_generation/` and associated API router.
4. Implement frontend **ADAM Generator** section with deep links from existing flows.
5. Add tests (unit, integration, and targeted regression) to ensure no existing features break.
6. Deploy to a staging environment and run domain-focused UAT with real or representative SDTM/ADAM scenarios.
