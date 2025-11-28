# Code Comparer Tab – End‑to‑End Implementation Plan

## 1. Objectives & Context

- Build an industry‑grade **Code Comparer** workspace that lets users load SAS and/or R programs (developer vs QC), compare them, and surface a clear visual and analytical report of similarities and differences.
- Frame this feature as an **AI Utility** within the existing ADAM AI workspace, aligned with the goal of being a domain‑friendly ADaM programming companion.
- Preserve all existing behaviour in Pair Programming, Code Review, Consolidated Code, ADAM Generator, Dataset Comparer, and other utilities; integrate Code Comparer without breaking current flows.

## 2. Scope & Non‑Goals

### 2.1 In Scope (MVP)

- Dedicated **Code Comparer** tab under AI Utilities, reachable from:
  - Workspace navigation (RightPanel + WorkspaceNavigation).
  - Landing page AI Utilities section.
- UI/UX for:
  - Importing or pasting two programs (Code 1, Code 2) in SAS or R.
  - Simple comparison options (ignore whitespace, ignore comments, case sensitivity).
  - Showing a side‑by‑side code view with clear diff highlighting.
  - Presenting similarity scores and categorized differences:
    - Code similarity.
    - Functional differences.
    - Logical differences.
    - Syntax differences.
    - Each with a brief justification and severity.
- Backend comparison service:
  - Text/structural diff.
  - Light static analysis and syntax checks.
  - LLM‑backed explanation and categorization of differences.
- Domain‑centric narrative aimed at ADaM programmers, mapping differences to impact on ADaM datasets when possible.

### 2.2 Out of Scope (Initial Iteration)

- Executing R/SAS code or comparing actual data outputs (this belongs to ADAM Generator / Dataset Comparer).
- Persistent comparison history and 21 CFR Part 11‑grade audit trails (can be added later, reusing broader audit architecture).
- Multi‑user collaboration within Code Comparer (comments, threaded discussions).
- Deep language‑specific AST comparison for SAS (initially rely on heuristics and LLM guidance).

## 3. User Personas & Key Flows

### 3.1 Personas

- **ADaM developer**: writes primary analysis programs and wants to see how QC code diverges.
- **QC programmer/reviewer**: checks that QC code is logically aligned while satisfying independence requirements.
- **Lead statistician / reviewer (later)**: wants a high‑level, non‑code‑centric view of how closely two programs match.

### 3.2 Primary Flows

1. **Quick ad‑hoc comparison**
   - User opens Code Comparer.
   - Pastes developer code on the left, QC code on the right.
   - Selects languages (R/SAS) or auto‑detect.
   - Clicks **Compare** and reviews similarity scores + highlighted differences.

2. **Study‑context comparison**
   - From an initialized workspace (study + dataset selected), user opens Code Comparer.
   - Optionally loads code snippets/files related to the current dataset (later integration with existing code generation outputs).
   - Uses comparison to justify acceptance of QC or to align implementations.

3. **Guided learning via samples**
   - User clicks “Load sample R comparison” or “Load sample SAS comparison”.
   - Page auto‑fills both sides with curated ADaM derivation code and runs comparison.
   - User observes how the tool explains and scores differences.

The UX across flows must remain **simple and low‑friction**: minimal required inputs, a single main CTA, and clear output hierarchy.

## 4. UX & Interaction Design

### 4.1 Entry Points & Navigation

- **Workspace**:
  - Code Comparer continues to be listed under AI Utilities in `WorkspaceNavigation` / `RightPanel`.
  - Selecting “Code Comparer” in navigation activates the Code Comparer tab component.
- **Landing Page**:
  - AI Utilities section includes a “Code Comparer” card.
  - Clicking this:
    - If no workspace context exists, initialize a demo study/workspace (reusing existing “demo study” initialization).
    - Navigate to workspace view and emit `adam-ai:navigate-workspace` with `/code-comparer` so RightPanel opens Code Comparer.

### 4.2 Page Layout (Simple, Professional)

**Top context bar**
- Left‑aligned:
  - Title: **Code Comparer** with a short subtitle, e.g. “Compare developer and QC programs for ADaM datasets”.
  - Optional context tags: Study ID, ADaM dataset name (if available from workspace state).
- Right‑aligned:
  - Language selectors for each side:
    - `Code 1 Language: [R | SAS | Auto]`
    - `Code 2 Language: [R | SAS | Auto]`
  - Small “Settings” button opening a popover with comparison options:
    - Ignore whitespace.
    - Ignore comments.
    - Case sensitive.

**Main code region**
- Two‑column layout:
  - **Left column – Code 1 (Developer)**.
  - **Right column – Code 2 (QC)**.
- Each column contains:
  - Header with label (“Code 1 – Developer”, “Code 2 – QC”) and optional file name.
  - Buttons:
    - “Paste” (focuses editor).
    - “Upload file” (local file input; filename shown once loaded).
    - “Load sample R/SAS” (per side or for both; see sample design).
  - Monaco editor area (or DiffEditor, see below) with syntax highlighting based on language.

**Comparison action strip**
- Centered below editors:
  - Primary `Compare` button (disabled until both sides have non‑empty code).
  - Small explanatory text: “We’ll compute similarity, categorize differences, and highlight key lines.”
  - Progress indicator while comparison runs (“Analyzing differences…”).

**Results area**
- Immediately below action strip; vertically stacked sections:
  1. **Similarity summary** (score + short text).
  2. **Differences overview** (categorized list / tiles).
  3. **Detailed difference list** with links into the code.
  4. **Syntax & static issues** per side.

Default expand the summary and differences overview; allow collapsing less‑frequently used sections to keep the page visually clean.

### 4.3 Editors & Visual Diff Behaviour

- Use `@monaco-editor/react`:
  - Preferred approach: Monaco **DiffEditor** configured such that:
    - “Original” = Code 1 (Developer).
    - “Modified” = Code 2 (QC).
    - Side‑by‑side view is enabled.
  - If DiffEditor integration is too constraining for UX:
    - Use two independent `Editor` instances and overlay our own markers based on backend diff spans.
- Core editor features:
  - Line numbers, syntax highlighting, word wrap off by default (toggleable later).
  - A consistent font and theme aligned with existing code views (RightPanel).
  - Clean error decoration for syntax issues (e.g., red underline, tooltip message).

### 4.4 Results Presentation

**4.4.1 Similarity summary**
- Card with:
  - Overall similarity score (0–100%) mapped to qualitative labels:
    - 90–100: “Very similar”.
    - 70–89: “Similar with minor differences”.
    - 40–69: “Moderately different”.
    - 0–39: “Significantly different”.
  - Sub‑scores (0–100%) for:
    - Code similarity.
    - Functional differences.
    - Logical differences.
    - Syntax differences.

**4.4.2 Narrative explanation**
- A concise LLM‑generated paragraph explaining:
  - Where the programs are structurally and logically aligned.
  - Where they diverge and potential impact on ADaM outputs (e.g., population flags, visit windows, imputation strategies).
  - Any notable domain patterns (e.g., handling of treatment‑emergent events, baseline definitions).

**4.4.3 Detailed differences list**
- Structured list or table:
  - Columns: Type, Severity, Code 1 location, Code 2 location, Summary.
  - Types:
    - `functional`: output‑affecting differences (e.g., conditions, joins).
    - `logical`: different conditions/flags but same broad intent.
    - `syntax`: syntax errors, missing semicolons, etc.
    - `refactor_only`: naming/structure changes without behaviour change (as far as detection allows).
  - Clicking a row:
    - Scrolls both editors to corresponding lines.
    - Temporarily highlights the affected ranges.

**4.4.4 Syntax & static checks**
- Panel listing issues per side:
  - Side (Code 1 / Code 2).
  - Line number.
  - Message and severity.
- Aim for incremental checks to keep complexity low, e.g.:
  - Unmatched brackets/parentheses.
  - Unclosed strings.
  - Obvious SAS/R syntax misspellings where feasible.

### 4.5 Sample Code Experience

- Provide at least two curated examples:
  - **R pair**: ADaM baseline flag derivation example (developer vs QC with small logical differences).
  - **SAS pair**: AE or ADSL derivation example.
- Implementation plan:
  - Define a `codeComparerSamples.ts` module exporting sample pairs and metadata.
  - In the UI, expose:
    - “Load R sample comparison” button: loads both sides and optionally auto‑runs comparison.
    - “Load SAS sample comparison” button: same pattern.
  - Mark samples clearly as **example** so users don’t confuse them with their own code.

## 5. Functional & Data Requirements

### 5.1 Inputs

- Required:
  - `code_1: string`, `code_2: string`.
- Optional:
  - `language_1`, `language_2`: `"sas" | "r" | "auto"`.
  - `options`:
    - `ignore_whitespace: boolean`.
    - `ignore_comments: boolean`.
    - `case_sensitive: boolean`.
  - Context (optional, for domain‑aware messaging later):
    - `study_id: string`.
    - `dataset: string` (e.g., `ADSL`, `ADAE`).

### 5.2 Outputs (High‑Level Response Shape)

- `overall_similarity_score: number` (0–1).
- `subscores: { code_similarity: number; functional_difference: number; logical_difference: number; syntax_difference: number }`.
- `classification_label: string` (e.g., “Very similar”, “Moderately different”).
- `explanation: string`.
- `differences: Array<{
    id: string;
    type: "code_similarity" | "functional" | "logical" | "syntax";
    severity: "low" | "medium" | "high";
    code1_span?: { start_line: number; end_line: number };
    code2_span?: { start_line: number; end_line: number };
    summary: string;
    details?: string;
  }>`
- `syntax_issues?: Array<{
    side: "code1" | "code2";
    line: number;
    severity: "warning" | "error";
    message: string;
  }>`
- Optionally, `raw_diff` structure for fine‑grained UI highlighting (e.g., diff hunks).

## 6. Frontend Architecture & Implementation Plan

### 6.1 Components

- **New main component**: `CodeComparerTab.tsx`
  - Lives under `frontend/src/components/`.
  - Integrated into `RightPanel` as the content for the `code-comparer` workspace tab key.
- Subcomponents:
  - `CodeComparerHeader` – title, subtitle, context tags.
  - `CodeComparerEditors` – both editors, language selectors, input controls.
  - `CodeComparerActionBar` – Compare button and progress.
  - `CodeComparerSummary` – scores and narrative explanation.
  - `CodeComparerDifferencesList` – categorized difference list.
  - `CodeComparerSyntaxPanel` – syntax issues per side.

Use Ant Design components (Cards, Alert, Typography, Tabs/list) for consistent styling; keep layout minimal and focused.

### 6.2 State Management

- For MVP, use component‑local state in `CodeComparerTab`:
  - `code1`, `code2`.
  - `language1`, `language2`.
  - `options` (ignore whitespace/comments, case).
  - `isComparing`, `errorMessage`.
  - `result` (typed as `CodeComparisonResult`).
- Optional later: introduce a dedicated Zustand slice if:
  - We need persistence across navigation.
  - We tie comparisons to study/dataset history.

State transitions:
- Initial: empty codes, no result.
- Editing: user modifies code/options.
- Comparing: `isComparing = true`, Compare disabled.
- Result: `result` populated, results sections rendered.
- Error: `errorMessage` shown, result cleared or kept as last successful result.

### 6.3 API Integration

- Extend `frontend/src/services/api.ts` (or a similar central service) with:
  - `compareCode(payload: CodeComparisonRequest): Promise<CodeComparisonResult>`.
- Implement error handling:
  - Map known backend error codes to user‑friendly messages (e.g., “Code length too large”, “Unsupported language”).
  - Fallback message for unknown errors.
- Integrate into `CodeComparerTab`:
  - Validate inputs client‑side before calling.
  - Ensure request includes workspace context if available (study/dataset).

### 6.4 Visual Diff Integration

- Attempt Monaco `DiffEditor` usage:
  - Wrap in a React component that:
    - Accepts `original` and `modified` strings, `language`.
    - Reacts to theme changes consistent with existing editors.
  - Ensure performance is acceptable for typical ADaM programs (tens to hundreds of lines).
- If DiffEditor is not viable:
  - Retain two separate `Editor` instances.
  - Use backend `raw_diff` spans to:
    - Add decorations (background highlights) for differing lines.
    - Indicate inserted/deleted blocks via margin glyphs.

### 6.5 Error, Loading & Empty States

- **Empty**: show a neutral illustration/text:
  - “Paste or upload code on both sides, then click Compare.”
  - Buttons for loading sample comparisons.
- **Loading**: overlay spinner near action bar and dim result area.
- **Backend failure**:
  - Ant Design `Alert` with summary, details, and a “Try again” button.
  - If static diff portion succeeded but LLM explanation failed, still show basic diff + scores and warn that explanation is unavailable.

## 7. Backend Architecture & Implementation Plan

### 7.1 New FastAPI Router & Service

- Add router file, e.g. `backend/app/api/v1/endpoints/code_comparer.py`:
  - Endpoint: `POST /code-comparer/analyze`.
  - Uses Pydantic models `CodeComparisonRequest` and `CodeComparisonResult`.
- Add service module `backend/app/services/code_comparer.py`:
  - Implements a pipeline:
    1. **Preprocessing**:
       - Normalize line endings.
       - Apply options (strip comments, collapse whitespace) to parallel “normalized” versions used for diff.
       - Detect/validate languages (if `auto`).
    2. **Textual diff**:
       - Use Python `difflib.SequenceMatcher` or similar to compute:
         - Similarity ratio.
         - Diff opcodes for changed regions.
    3. **Structural/logical heuristics**:
       - For R:
         - Lightweight parsing: identify `data.frame`/`dplyr` pipelines, key conditions, joins.
       - For SAS:
         - Identify DATA/PROC steps, key `IF`, `MERGE`, `BY`, `WHERE` clauses.
       - Aggregate signals on which transformations are present/absent in each code.
    4. **Syntax checks**:
       - Basic checks (balanced brackets, unclosed strings, semicolon presence for SAS).
       - Optionally reuse existing R execution/syntax tooling but **without running the code** (static checks only).
    5. **LLM‑driven classification & explanation**:
       - Use existing LLM integration (Gemini/OpenAI/Anthropic) to:
         - Classify differences into functional, logical, syntax, refactor.
         - Propose severity.
         - Generate the human‑readable `explanation` and per‑difference `summary`/`details`.
    6. **Scoring**:
       - Combine static diff ratio and LLM classification to compute:
         - Overall similarity score.
         - Subscores for each category.

### 7.2 API Contracts (High Level)

- `CodeComparisonRequest`:
  - `code_1: str`, `code_2: str`.
  - `language_1: Optional[str]`, `language_2: Optional[str]`.
  - `ignore_whitespace: bool`, `ignore_comments: bool`, `case_sensitive: bool`.
  - Optional `study_id`, `dataset`.

- `CodeComparisonResult`:
  - As described in section 5.2, mapped to JSON.

Validation & constraints:
- Enforce maximum code length (e.g., 10k–20k characters per side for MVP).
- Only accept supported languages; otherwise treat as plain text with limited analysis.

### 7.3 Performance, Reliability & Logging

- Timeouts:
  - Keep static diff under a short timeout (e.g., <1s for typical programs).
  - LLM explanation under a configurable upper bound (e.g., 10–15s), with graceful fallback.
- Observability:
  - Log latency, diff sizes, and similarity distribution **without** storing full code.
  - Include high‑level flags like “LLM explanation used: yes/no”, “syntax check passed: yes/no”.
- Error handling:
  - Distinguish between client errors (validation) and server errors (internal, LLM timeouts).
  - Return structured error codes for the frontend.

### 7.4 Security & Compliance Considerations

- Treat uploaded code as sensitive:
  - Do not log raw code bodies.
  - Keep code data in memory for the duration of comparison only.
- Respect existing configuration for external LLM providers:
  - Use feature flags/env vars to disable sending code to external services in restricted environments.
  - If external calls are disallowed, degrade to static diff and clearly mark that functional/logical scoring is limited.

## 8. Integration with Existing System

### 8.1 UI Integration

- **RightPanel**:
  - Swap out current Code Comparer placeholder component for `CodeComparerTab` while keeping the workspace tab key (`'code-comparer'`) and navigation events unchanged.
  - Ensure Code Comparer respects existing RightPanel layout and theming.

- **LandingPage / AI Utilities**:
  - Confirm that “Code Comparer” tile (already added) calls the workspace navigation helper that:
    - Initializes a demo workspace if needed.
    - Switches view mode to workspace.
    - Dispatches `adam-ai:navigate-workspace` with `/code-comparer`.

### 8.2 Backend Integration

- Register the new `code_comparer` router in the FastAPI app under `/api/v1/code-comparer`.
- Keep the path and naming consistent with existing API structure; avoid reusing names of existing endpoints.

### 8.3 Feature Flag & Fallback

- Introduce environment config, e.g. `CODE_COMPARER_ENABLED`:
  - Frontend:
    - If disabled, show current informational placeholder explaining that the feature is “Coming soon”.
  - Backend:
    - Optionally reject calls with a clear error when disabled.

This ensures safe rollout without impacting other utilities.

## 9. Testing & Validation Strategy (Planning Only)

### 9.1 Backend Tests

- Unit tests:
  - Preprocessing (options application).
  - Diff ratio computation for simple pairs (identical, small changes, large changes).
  - Syntax checker behaviour for known error snippets.
  - Response shape for typical cases and validation errors.
- Integration tests:
  - End‑to‑end `POST /code-comparer/analyze` using small SAS/R examples.
  - Cases: identical code, refactor‑only changes, clear logical differences, one side syntactically invalid.

### 9.2 Frontend Tests

- Component tests for `CodeComparerTab`:
  - State transitions: empty → ready → comparing → success → error.
  - UI mapping from mock `CodeComparisonResult` to summary cards and difference list.
- Interaction tests (where framework is available):
  - Ensuring Compare button is disabled until both codes are provided.
  - Clicking a difference row scrolls editors to correct sections.

### 9.3 UX & Domain Validation

- Run domain‑centric review sessions with ADaM programmers:
  - Validate that narrative explanations and severity labels are meaningful.
  - Check that the UI is perceived as simple and not overwhelming.
- Collect feedback on:
  - Default scoring thresholds.
  - Terminology used in labels and explanations.

## 10. Edge Cases & Failure Modes

- One or both code inputs empty → Compare disabled with inline hint.
- Code exceeds size limits → backend returns a specific error; frontend shows guidance (e.g., “Please compare smaller sections or refactor into modules”).
- Invalid language labels → treat as plain text; inform user that analysis is limited.
- Syntax parser fails for a side → still show textual diff; highlight limited syntax understanding.
- LLM unavailable or times out:
  - Provide static similarity score and raw diff‑based differences.
  - Show banner: “Advanced explanation temporarily unavailable; showing basic comparison only.”

## 11. Rollout & Observability

- **Phase 1 – Development/Staging**
  - Implement backend and frontend behind feature flag.
  - Test with curated sample programs and real‑world snippets from ADSL/ADAE.
- **Phase 2 – Internal Pilot**
  - Enable for internal users only.
  - Monitor:
    - Number of comparisons per user/day.
    - Average latency.
    - Error rates.
    - Distribution of similarity scores.
- **Phase 3 – Production Enablement**
  - Enable in production environments where policy allows code to be analyzed with LLMs.
  - Document:
    - Usage guidelines for ADaM programmers.
    - Any limitations (e.g., no formal validation of numeric equivalence).

## 12. Open Questions / Clarifications Needed

1. **Cross‑language comparison**  
   Should we explicitly support comparing **SAS vs R** (e.g., R QC vs SAS production), and if so, how strict should functional equivalence detection be in MVP?

2. **Persistence & audit**  
   Do we need to **persist comparison results** (and underlying code) as part of regulatory documentation (21 CFR Part 11) for this phase, or can the feature remain session‑based/ephemeral initially?

3. **Export/reporting requirements**  
   Is there a requirement to **export a comparison report** (PDF/HTML) summarizing similarity scores, key differences, and explanations for QC sign‑off?

4. **Maximum expected program size**  
   What is the realistic maximum size of programs users intend to compare (lines/KB), so we can set sane limits and optimize performance accordingly?

5. **LLM provider constraints**  
   Are there environments where **external LLM calls are prohibited**, requiring on‑prem models only, or should we design the comparer to operate in “static‑diff‑only” mode in such cases?

6. **Scoring thresholds & business rules**  
   Should similarity thresholds (e.g., what counts as “acceptable similarity” between dev and QC code) be configurable per environment/study, or is a fixed threshold acceptable for now?

---

This plan keeps the Code Comparer page **simple but powerful**, grounded in ADaM programming workflows, aligns with the existing ADAM AI architecture, and is structured to avoid regressions while allowing iterative enhancement toward an industry‑grade comparison tool.

