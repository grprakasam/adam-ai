


you should create plan for the details present in  'Context\0_MyRequirement_planner.md'

Take the role of planner and a system architect who is careful in not breaking any existing features while adding new features by ensuring the best of coding practices.



**MUST DO**
1. first clearly understand the entire contents of .md filed present across different folders under ADAM_AI
2. understand the required feature detailed under 'Context\0_MyRequirement_planner.md'

strictly adhere to the instructions defined in all the .md files present under the 'Context\ProjectArchitecture\' folder  


--------------
**Guidelines**
*Create a clean and structured and logical plan - easy for executing
Apply the best and latest methods by searching the internet to make this app with great user experience
*Dont execute any code
provide me a  clean and structured and logical  plan - easy for executing
provide the plan under the file named 'My_Initial_Plan.md' inside the 'Context\' folder

dont assume
If there are any clarifications, ask me and then plan

if there are any missing elements in the plan, identify and mention them clearly so that they can be added in the revised plan

ultrathink to ensure that this plan is perfect and nothing is missing and also ensure that the plan is not breaking any existing features

---

# Submission Readiness – Initial Implementation Plan (v1)

Status: Planning approved for drafting (no code changes)
Scope: Add a new “Submission Readiness” tab (after Traceability) with two vertical sub-tabs: “p21 Core Validation” and “FDA Submission Package” without breaking any existing features.

---

## 1) Agreed Scope & Assumptions

- Regulatory focus: FDA; align with ADaM and submission expectations.
- P21 CE integration: run via Docker; apply rule sets for ADaM only; no sponsor-specific checks.
- Controlled Terminology: read from a local Excel file `Content/ControlledTerminology/ControlledTerminology.xlsx` (single file). Allow MedDRA/NCI selections; default to latest available in file.
- Define.xml: generate for ADaM only (Define-XML 2.1). Provide placeholders for sponsor info (StudyName, ProtocolName, Originator, etc.).
- ADRG/SDRG: generate from placeholder DOCX templates (editable). No SDTM linkages in v1.
- eCTD: create commonly used (FDA) structure; attempt complete submission-ready package where feasible for ADaM artifacts only.
- Electronic signatures: no gating; add placeholders for future e-signature capture.
- Audit trail: placeholders only (model + log hooks); no enforcement in v1.
- Artifacts & storage: practical, simple on-disk structure (defined in section 6).
- Scope of datasets: All ADaM datasets supported by the app. Define.xml/ADRG/SDRG linkages limited to ADaM in v1 (no SDTM).
- Performance & security: simple approach; resource limits on Docker jobs; local-only processing; no PHI expected.

Constraints and guardrails
- Do not modify or regress “Traceability” or existing Pair Programming flows. All work is additive.
- Use existing stack and patterns: React + TypeScript + Ant Design (frontend), Zustand store; FastAPI + Pydantic (backend).
- Follow Context/ProjectArchitecture guidance: simple, intuitive UX; modular components; workflow-first; don’t replace P21—integrate it.

---

## 2) UX Flow & IA (Information Architecture)

Placement
- Add a new primary tab to the right panel navigation: “Submission Readiness”, positioned immediately after “Traceability”.
- Within it, use vertical sub-tabs:
	1) “p21 Core Validation”
	2) “FDA Submission Package”

2.1) p21 Core Validation – UI sections
- Study & Dataset Context (read-only summary): Study ID, Dataset(s), Standards versions; link to where users can adjust.
- Pre-P21 Structural Checks (button): runs quick structural validation on selected ADaM dataset metadata (required vars, keys, labels ≤256, date/datetime flags, naming rules per `Context/ADAMRules/ADAM_VariablenamingRules.md`).
- Controlled Terminology Validation (button): validates variables bound to codelists using `ControlledTerminology.xlsx`. Version selector (MedDRA version dropdown; default to the latest found). File path indicator with “Change file” option.
- Pinnacle 21 CE Validation (button): triggers Docker run with ADaM ruleset; shows progress indicator; results parsed into a unified UI.
- Results area with three tabs: Summary | Issues | Artifacts
	- Summary: pass/fail counts by severity; high-level recommendations.
	- Issues: filterable table (severity, domain/dataset, variable, rule code, message, location). Export CSV/Excel.
	- Artifacts: links to raw P21 outputs and pre-check reports.
- Non-blocking UX: users can run Pre-P21/CT checks standalone, and/or directly run P21 CE.

2.2) FDA Submission Package – UI sections
- Study Metadata Card: fields with defaults and sponsor placeholders (Study Name, Protocol, Description, Sponsor, ADaM IG version, MedDRA version). Non-intrusive help text describing what is included in Define.xml and ADRG/SDRG.
- Define.xml (ADaM) Generator: “Generate” button; options for stylesheet link (placeholder), include variable-level docs, include value-level metadata (future), select datasets to include. Output preview link once generated.
- ADRG Generator (placeholder template): “Generate ADRG” button; uses DOCX template; includes overview, datasets list, derivation summaries (from app context if available), validation notes (optional).
- SDRG (Study Data Reviewer’s Guide) – ADaM-focused: “Generate SDRG” button; placeholder DOCX template; include table of included data and documentation artifacts.
- eCTD Packaging: select target directory; generate M5 data structure (FDA common layout) with Define.xml, ADRG, SDRG and referenced program files/artifacts; optional zip packaging.
- Artifacts area: list all generated files with timestamps and checksums (placeholders now); actions: Download, Reveal in folder.

Interaction principles (from architecture docs)
- Keep steps simple; progressive disclosure; default sensible values; reduce cognitive load.
- Clear status indicators; predictable actions; consistent AntD components; keyboard accessible.

---

## 3) Backend Design (Additive, Modular)

Foldering (no renames of existing code)
- `backend/app/modules/validation/`:
	- `adam_conformance.py` – Pre-P21 structural checks (as in concept doc): required vars, keys, label length, DT/DTM/FL/GR naming checks per `Context/ADAMRules/ADAM_VariablenamingRules.md`.
	- `controlled_terminology.py` – CT loader/validator reading `Content/ControlledTerminology/ControlledTerminology.xlsx`.
	- `p21_runner.py` – Orchestrates Docker run of P21 CE; mounts inputs/outputs; selects ADaM ruleset; parses outputs.
- `backend/app/modules/submission/`:
	- `define_xml_generator.py` – Define-XML 2.1 (ADaM only) with sponsor placeholders (StudyName, ProtocolName, Originator, etc.).
	- `adrg_generator.py` – ADRG DOCX generator using placeholder template(s).
	- `sdrg_generator.py` – SDRG DOCX generator using placeholder template(s).
	- `ectd_packager.py` – Creates FDA-style eCTD M5 folder structure for ADaM outputs; optional ZIP.
- `backend/app/modules/submission/models.py` – Pydantic models for requests/responses (StudyInfo, DatasetInfo, ValidationIssue, ArtifactRef, PackagingOptions, etc.).
- `backend/app/api/v1/endpoints/` (new endpoints):
	- `validation_prep21.py` – POST `/validation/prep21`
	- `validation_ct.py` – POST `/validation/ct`
	- `validation_p21.py` – POST `/validation/p21`
	- `submission_define.py` – POST `/submission/definexml`
	- `submission_docs.py` – POST `/submission/adrg` and `/submission/sdrg`
	- `submission_package.py` – POST `/submission/ectd/package`

P21 CE via Docker
- Image: use a private container that bundles P21 CE Community Edition + Java runtime (created by ops), or run a base JRE image that mounts the P21 CE JAR from host. The service only shells `docker run` with controlled args.
- Volumes: mount input datasets/specs and a dedicated output folder; limit to read-only where applicable.
- Ruleset: ADaM rules as shipped with P21 CE.
- Resource limits: CPU/memory caps; max timeout (e.g., 5–10 minutes per run) with cancellation.
- Parser: normalize P21 outputs (CSV/XML/JSON/HTML as available) into a standard JSON schema for the UI: `{severity, dataset, variable, ruleId, message, location, category}`.

Controlled Terminology
- Expect a single Excel `ControlledTerminology.xlsx` with sheets for codelists; parse into `{codelist -> allowed values}`.
- Provide lightweight mapping from variable to codelist (if available via metadata/spec); otherwise, allow user to specify CT binding per variable in a small UI helper (backlog if not in v1).

Define.xml (ADaM only)
- Generate ItemGroupDefs for selected ADaM datasets with ItemRefs for variables; include minimal controlled terminology links where available; add placeholders for sponsor metadata.
- Validate XML structure and schema locally (optional backlog).

ADRG / SDRG Generators (DOCX)
- Use `python-docx` to fill section headings and tables; include minimal data: study info, list of ADaM datasets, derivation summary pointers (if available), validation summary (optional), and references to Define.xml.
- Keep branding fields as placeholders for sponsor addition in Word.

eCTD Packaging (ADaM portion)
- Create a conventional FDA structure under M5 for analysis datasets and metadata; include Define.xml, ADRG, SDRG, and program files (if present/selected).
- Optionally, compress to a ZIP archive; record checksums and a manifest JSON (for future audit trail integration).

Artifacts & Storage (simple, practical)
- Root: `Content/Submissions/<StudyId>/`
	- `validation/prep21/` – pre-checks results
	- `validation/ct/` – CT check results
	- `validation/p21/` – P21 raw outputs + parsed JSON
	- `definexml/` – generated Define.xml
	- `docs/` – ADRG.docx, SDRG.docx
	- `ectd/` – eCTD tree, `package.zip` (if created)
	- `manifest.json` – list of artifacts with timestamps and checksums (MD5/SHA256; placeholder implementation in v1)

Audit trail placeholders
- Model + hooks only (no UI gating): record actor, timestamp, action, resourceId, checksum (if available) to a local append-only log file and/or JSONL under `Content/Submissions/<StudyId>/audit/`.

---

## 4) Frontend Design (Additive)

Components (new)
- `frontend/src/components/SubmissionReadinessTab.tsx` – container with vertical tabs and shared study context header.
- `frontend/src/components/p21/P21CoreValidationPanel.tsx` – Pre-P21, CT, P21 run controls and results.
- `frontend/src/components/submission/FDASubmissionPackagePanel.tsx` – Define.xml, ADRG, SDRG, eCTD generation and artifact list.
- `frontend/src/components/submission/ArtifactsList.tsx` – reusable artifacts table with actions.

State (extend Zustand)
- Add to `frontend/src/store/projectStore.ts`:
	- `studyInfo`, `standards` (adamIgVersion, meddraVersion)
	- `ctFilePath` and load status
	- `prep21Results`, `ctResults`, `p21Results`
	- `defineXmlStatus`, `adrgStatus`, `sdrgStatus`, `packagingStatus`
	- `artifacts` registry for the Submission tab

Navigation
- Register `SubmissionReadiness` tab in `RightPanel.tsx` after `Traceability` with lazy load. No change to existing tab order besides insertion.

UX patterns
- Ant Design forms, tables, alerts, progress indicators.
- Non-blocking asynchronous actions with clear “Running/Done/Failed”.
- CSV/Excel export for issue tables.

---

## 5) API Endpoints (draft contracts)

- POST `/api/v1/validation/prep21`
	- Input: `{ studyId, datasetNames[], rulesPreset?: 'default' }`
	- Output: `{ issues: Issue[], summary: { bySeverity: {...} } }`

- POST `/api/v1/validation/ct`
	- Input: `{ studyId, datasetName, ctFilePath, versions?: { meddra?: string }, bindings?: { [varName]: codelist } }`
	- Output: `{ issues: Issue[], summary: {...} }`

- POST `/api/v1/validation/p21`
	- Input: `{ studyId, adamPaths[], ruleset: 'ADaM', timeoutSec?: number }`
	- Output: `{ issues: Issue[], artifacts: ArtifactRef[], raw?: { ... } }`

- POST `/api/v1/submission/definexml`
	- Input: `{ studyInfo, datasets: DatasetInfo[] }`
	- Output: `{ artifact: ArtifactRef, warnings?: string[] }`

- POST `/api/v1/submission/adrg`
	- Input: `{ studyInfo, datasets: DatasetInfo[], notes?: string }`
	- Output: `{ artifact: ArtifactRef }`

- POST `/api/v1/submission/sdrg`
	- Input: `{ studyInfo, datasets: DatasetInfo[], notes?: string }`
	- Output: `{ artifact: ArtifactRef }`

- POST `/api/v1/submission/ectd/package`
	- Input: `{ studyId, include: { defineXml: boolean, adrg: boolean, sdrg: boolean, programs?: boolean }, zip?: boolean, targetDir?: string }`
	- Output: `{ artifact: ArtifactRef, tree: string[] }`

`Issue`
- `{ severity: 'ERROR'|'WARNING'|'INFO', dataset?: string, variable?: string, ruleId?: string, message: string, location?: string, category?: string }`

`ArtifactRef`
- `{ name: string, path: string, createdAt: string, checksum?: string }`

---

## 6) Data, Files & Conventions

- Controlled Terminology Excel: `Content/ControlledTerminology/ControlledTerminology.xlsx`
	- Expected sheets: `Codelists`, optionally one sheet per codelist (simple v1: single table with columns: `Codelist`, `Code`, `Decode`, `Version`, `Standard`).
- Study input/config: reuse existing project configuration; extend as needed for sponsor placeholders.
- Artifacts storage: `Content/Submissions/<StudyId>/...` as detailed above.
- Limits: max ADaM files per run (e.g., 20), max file size (e.g., 200MB per dataset) – simple, configurable.

---

## 7) Non-Breaking Strategy & Feature Flagging

- Additive routes and components only; no changes to existing flows/components other than registering a new tab.
- Guard the new tab with a feature flag `enableSubmissionReadiness` (default true only in dev). In production, enable via config.
- Lazy load the tab to avoid bundle bloat/latency for users who don’t use it.
- Backend endpoints are new; no changes to existing endpoints.

---

## 8) Test Strategy

Unit tests (backend)
- `adam_conformance.py`: required variables, label length, naming checks.
- `controlled_terminology.py`: CT loader, sheet parsing, value checks.
- `define_xml_generator.py`: minimal ADaM ODM structure rendered; XML well-formedness.
- `ectd_packager.py`: correct folder tree and manifest generation.

Integration tests
- Stub a minimal ADaM dataset and run Pre-P21 + CT.
- Stub P21 outputs (CSV/XML) to validate parser without running Docker in CI.
- End-to-end: generate Define.xml + ADRG/SDRG from sample inputs and package eCTD to a temp directory.

Frontend tests
- Component render and interaction tests for action buttons and state transitions.

---

## 9) Delivery Plan (Phased)

Phase 0 – Scaffolding (0.5 week)
- Create backend modules and endpoint stubs; wire artifacts storage; add models.
- Add frontend tab, skeleton panels, and store slices; basic UI without actions.

Phase 1 – Pre-P21 + CT (1 week)
- Implement Pre-P21 structural checks and CT validator; UI for running/seeing results; export.

Phase 2 – P21 CE Integration (1–1.5 weeks)
- Add Docker runner, rule selection (ADaM), results parsing; progress UI; artifacts links.

Phase 3 – Define.xml (ADaM) (1 week)
- Implement generator with placeholders; download/view; validation warnings if any.

Phase 4 – ADRG/SDRG Templates (0.5–1 week)
- Generate DOCX from templates; basic sections populated; artifacts list.

Phase 5 – eCTD Packaging (0.5–1 week)
- Produce FDA-style folder tree and optional ZIP; manifest and checksums (basic).

Phase 6 – Polish & QA (0.5 week)
- UX refinements, docs, smoke tests; ensure no regressions; enable feature flag by env.

---

## 10) Risks & Mitigations

- P21 CE Docker image availability: coordinate with ops to supply a compliant base image; meanwhile provide parser stubs and a dry-run mode.
- CT Excel schema variance: document expected columns; add defensive parsing and friendly errors; allow user to upload a different file.
- eCTD details vary across organizations: implement a commonly accepted FDA structure; keep structure mapping configurable for future.
- Performance for large studies: apply Docker resource limits; add server-side timeouts; stream progress to UI.

---

## 11) Open Items (for finalization)

- P21 CE container details: image name, entrypoint/CLI args, ruleset path, and licensing acceptance steps.
- Final CT Excel schema (column names) and example file to validate loader.
- Confirm sponsor placeholder fields to expose in Define.xml/ADRG/SDRG (StudyName, ProtocolName, Originator, etc.).
- Location and naming for program files to include in eCTD (if any) beyond generated artifacts.

---

## 12) Acceptance Criteria (v1)

- Users can run Pre-P21 checks and see issues without uploading anything beyond existing ADaM outputs/metadata.
- Users can select a CT Excel file and validate CT bindings; clear, filterable issue list; exportable results.
- Users can run P21 CE via Docker with ADaM rules and view normalized issues + raw artifacts.
- Users can generate Define.xml (ADaM only) with sponsor placeholders; download the XML.
- Users can generate ADRG/SDRG placeholder DOCX documents and download them.
- Users can generate an FDA-style eCTD folder structure for ADaM artifacts and optionally zip it.
- No regressions in existing tabs and workflows; new tab loads lazily and performs responsively.