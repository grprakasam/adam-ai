## 1. Context Assimilation & Constraints
- Review complete set of Markdown specifications across the repo (ProjectArchitecture, requirement trackers, rules) to ensure any change aligns with existing domain expectations, tech stack (React + Ant Design, FastAPI, Gemini/other LLMs), and the staged workflow (spec ingestion → variable categorisation → pair programming → final generation).
- Respect ADAMRules-driven logic: no automated code generation step should bypass derivations already validated via the pair-programming UI.
- Preserve current flows (Landing → Projects → Workspace and new AI Pair Programmer tool) while inserting the “Consolidated Code” experience as a complementary step rather than a disruptive rewrite.
- Treat security requirements seriously: any new API/Gemini calls must honour the “data security mode” paradigms already introduced (API vs. local service) and use existing environment configuration patterns defined in TECH_STACK.md.

## 2. Requirements Breakdown (from 0_MyRequirement_planner.md)
1. Detect when every variable in the pair-programming table is approved (“Approve” button).
2. Aggregate the final code snippets (with user edits + notes) into one consolidated, industry-standard program organised by variable categories.
3. Optimise that consolidated program (remove redundancy, enforce standards, add error handling/validation, respect comment verbosity preference).
4. Provide UI to trigger consolidated generation (“Generate Consolidated Code” button placed prominently), show progress percentage & elapsed time, handle success/error messaging, and render result in syntax-highlighted viewer with download option.
5. Surface consolidated experience as its own tab (“Consolidated Code”), keeping workspace tabs intact.
6. Perform end-to-end regression testing to ensure no existing flows regress.

## 3. Functional Architecture Plan
### 3.1 Backend Enhancements
1. **Approval State Service**
   - Extend project store (frontend + persisted backend state if any) to surface an `areAllVariablesApproved` flag derived from pairProgramming snippets.
   - Provide backend verification endpoint `GET /program-generation/approved-status` (optional) to double-check approvals before generating consolidated code.
2. **Consolidated Code Generation Endpoint**
   - New `POST /program-generation/consolidated` accepting:
     - `study_id`, `dataset`, target language, comment verbosity, execution mode (API vs. local).
     - Ordered list of approved variables (name, category, final snippet, user notes, metadata).
   - Pipeline:
     1. **Sanitise & normalise** user snippets (remove placeholder text, unify indentation).
     2. **Category-based assembler** that groups variables per category, ordering by dataset conventions (per ADAMRules).
     3. **Optimisation pass**: static analysis to drop unused temp vars, collapse redundant merges, insert macro/functions for repeated logic.
     4. **Error handling scaffolding**: wrap with dataset existence checks, logging, validation macros/procs.
     5. **Comment engine** driven by verbosity (low/med/high) to summarise logic at section or statement level.
     6. **Validation hooks**: integrate with existing validation service to ensure produced code passes syntax/standards checks before returning.
   - Return payload includes consolidated code, structured summary (categories included, performance hints), generation duration, and any warnings.
3. **Progress & Telemetry**
   - Introduce task controller (synchronous for now) that emits status events (queued → assembling → optimisation → validation → complete).
   - For future long-running support, design endpoint to accept `request_id` and allow polling for progress/time metrics.
4. **Local vs API Execution**
   - Respect `execution_mode`:
     - `api`: use existing LLM service.
     - `local`: route through Ollama client (provide stub referencing config path; if unavailable, return descriptive error). Ensure no outbound network call in this path.

### 3.2 Frontend Enhancements
1. **State Extensions**
   - Update `projectStore` with:
     - `commentVerbosity: 'low' | 'medium' | 'high'`.
     - `executionMode: 'api' | 'local'`.
     - `consolidatedCode`, `isGeneratingConsolidated`, `generationProgress`, `generationTime`, `generationMessages`.
2. **UI Entry Points**
   - Add a “Generate Consolidated Code” primary button in a prominent workspace toolbar (visible once approvals ≥ threshold). Disable with tooltip until approvals complete.
   - Add new tab “Consolidated Code” next to existing sections; opening tab shows CTA if code not yet generated, else displays results.
3. **Consolidated Code Tab Layout**
   - **Header strip**: dataset name, approval status summary, last generated timestamp, total variables included.
   - **Controls**: language selector (inherits from workspace), comment verbosity radio, execution mode radio (API vs Local) mirroring Code Migration page for consistency.
   - **Progress indicator**: circle or horizontal bar showing percentage plus textual status; display spinner + “Estimating time…” while running, then freeze final duration.
   - **Result panes**:
     - Syntax-highlighted code viewer (Monaco) with copy/download/regenerate actions.
     - Collapsible summary cards (categories included, optimisation applied, validation results).
     - Message area for warnings/errors.
4. **UX Flows**
   - After clicking CTA, disable relevant controls, show progress, call new endpoint, update metrics/time.
   - On error, show inline alert with actionable text and keep previously generated code if available.
   - Provide “Regenerate” option to re-run after adjusting verbosity or execution mode.

### 3.3 Data & Dependencies
1. Ensure pair-programming data structure records both original snippets and user edits; consolidated generator must use latest user version.
2. Persist consolidated code in store (and optionally backend session) so users can revisit without regenerating.
3. If local mode selected, surface prerequisites (Ollama running, supported models) and fail gracefully with guidance.
4. Adhere to ADAMRules context when grouping categories—re-use same metadata loader to avoid drift.

## 4. Quality, Security, and UX Considerations
1. **Security/Data Privacy**
   - Honour offline mode by short-circuiting any LLM API call; log only anonymised metadata.
   - Sanitize user snippets before sending to LLM to avoid leaking PHI in logs.
2. **Performance**
   - Use streaming/progressive updates for long consolidation tasks; ensure backend responds within timeouts by chunking heavy operations.
   - Cache previous consolidated outputs keyed by approvals + settings to avoid redundant regeneration.
3. **Testing Strategy**
   - Unit tests for backend assembler (category grouping, optimisation rules, comment engine).
   - Integration tests simulating full approval → generation flow for both R and SAS, ensuring consistent ordering and validation.
   - Frontend Cypress (or similar) tests to verify button enablement, progress indicator, error states.
   - Regression checks on existing pair-programming and code generation workflows to ensure no breakage.
4. **Documentation**
   - Update Help/FAQ with consolidated-code instructions, mention data security modes, and describe comment verbosity options.
   - Provide inline tooltips for new controls.

## 5. Open Questions / Clarifications Needed
1. **Ollama Environment Details**: Which local models/configs should we pin for deterministic conversions? Are there performance constraints to account for?
2. **Language Conversion Scope**: Can users request SAS↔R conversion even if initial snippets mixed languages, or should we limit to source dataset language?
3. **Validation Benchmarks**: Are there specific CDISC compliance checks (beyond current validation service) required before exposing consolidated output?
4. **Download Format**: Should we bundle documentation (HTML/PDF) alongside code, or is plain `.sas`/`.R` sufficient?

Once these clarifications are resolved, we can refine timelines and implementation tickets in a revised plan.
﻿
