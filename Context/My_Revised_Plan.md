# ADAM AI – Revised Execution Plan

## Executive Summary
This revised plan addresses critical gaps in the initial plan by incorporating:
1. **Variables Analysis Page** – A dedicated UI for categorized variable grouping based on VariablesMapping.xlsx
2. **Enhanced specification parsing** – Parse and categorize variables according to ADAM rules
3. **Progressive disclosure workflow** – Stage-based user confirmations aligned with domain logic
4. **Backend services** – Excel parsing, variable categorization, and mapping services

## Key Gaps Identified in Initial Plan

### **CRITICAL MISSING ELEMENTS:**

1. **Variables Analysis Page** (from requirement 0_MyRequirement_planner.md)
   - NOT mentioned in initial plan
   - Required: Categorized variable grouping UI with tabbed interface
   - Must use VariablesMapping.xlsx for categorization
   - Should appear after spec upload, before generation

2. **VariablesMapping.xlsx Integration** (from ADSL_ApplicationBehaviourRules.md)
   - Initial plan mentions parsing but not variable categorization
   - Missing: Service to read and apply VariablesMapping.xlsx
   - Missing: Backend endpoint to categorize uploaded variables

3. **Progressive User Confirmation Workflow**
   - Initial plan focuses on linear flow
   - Missing: Stage-by-stage user confirmations per ProjectRequirements.md
   - Missing: Interactive validation at each stage

4. **Domain-Specific Context Building**
   - Initial plan treats LLM prompting generically
   - Missing: Dataset-specific context assembly (ADSL vs ADAE vs ADLB)
   - Missing: Rule-based prompt template selection

5. **Variable Dependency Analysis**
   - Hardcoded categories in VariablesTab.tsx
   - Missing: Dynamic loading from VariablesMapping.xlsx
   - Missing: Dependency graph validation

## Revised Architecture

### **Frontend – Enhanced Tab Flow**

```
Landing Page
    ↓ (Get Started)
Workspace Page
    ├── Tab 1: Project Information ✓ (Completed)
    ├── Tab 2: Dataset Selection ✓ (Completed)
    ├── Tab 3: Specification Upload ✓ (Completed)
    ├── Tab 4: Variables Analysis ⚠️ (NEW - CRITICAL)
    │   ├── Auto-loads after spec upload
    │   ├── Displays categorized variables from VariablesMapping.xlsx
    │   ├── Tabbed UI per category (Identifiers, Treatment, Demographics, etc.)
    │   ├── Variable cards with: name, label, type, source, derivation preview
    │   ├── Selection checkboxes (required vars pre-checked, disabled)
    │   ├── Search/filter functionality
    │   └── Confirmation button → unlocks next tab
    ├── Tab 5: Standards Selection ✓ (Completed)
    ├── Tab 6: Rules Configuration ✓ (Completed)
    └── Tab 7: Generate & Review
        ├── Pre-generation summary panel
        ├── Confirm & Generate CTA
        └── Results display (code, validation, docs)
```

### **Backend – New Services**

```
New Modules Required:
├── specification_parser/
│   ├── excel_reader.py          # Existing, enhance with validation
│   ├── variable_extractor.py    # NEW: Extract variable rows
│   └── variable_validator.py    # NEW: Validate against naming rules
├── variable_categorizer/
│   ├── mapping_loader.py         # NEW: Read VariablesMapping.xlsx
│   ├── categorizer.py            # NEW: Map vars to categories
│   └── dependency_resolver.py    # NEW: Build dependency graph
├── context_builder/              # Exists, enhance
│   ├── dataset_context.py        # NEW: Dataset-specific contexts
│   └── rule_selector.py          # NEW: Select rules per dataset type
└── confirmation_tracker/         # NEW: Track stage completions
    └── progress_validator.py     # Validate completion before generation
```

---

## Detailed Implementation Plan

### **PHASE 1: Variables Analysis Infrastructure (Priority: HIGHEST)**

#### **Backend Tasks**

**1.1 Variables Mapping Service**
```python
# File: backend/app/modules/variable_categorizer/mapping_loader.py

Purpose: Read and parse VariablesMapping.xlsx
Deliverables:
  - Load Excel with categories and variable attributes
  - Return structured JSON: {category: str, variables: [{name, group, priority}]}
  - Cache mapping in memory (reload on config change)
  - Validation: Ensure required columns exist

Dependencies: openpyxl, pandas
Acceptance: Can load VariablesMapping.xlsx and return category structure
```

**1.2 Variable Categorization Endpoint**
```python
# Route: POST /api/spec/categorize

Input: {specId: str}
Process:
  1. Load parsed specification variables (from existing parse endpoint)
  2. Load VariablesMapping.xlsx categories
  3. Match each spec variable to category (by name pattern or exact match)
  4. Enrich with metadata (required status, dependencies, CDISC type)
Output: {
  categories: [
    {
      name: "Identifier Variables",
      description: "...",
      variables: [
        {name: "STUDYID", label: "...", type: "Char", 
         source: "DM", required: true, category: "Identifiers"}
      ]
    }
  ],
  uncategorized: [...],  # Variables not found in mapping
  warnings: [...]
}

Validation:
  - Warn if variables missing from mapping
  - Flag if required variables absent from spec
```

**1.3 Enhanced Specification Parser**
```python
# Enhance: backend/app/modules/input_collection/spec_parser.py

Additions:
  - Extract variable metadata: name, label, type, length, source, derivation logic
  - Validate against ADAM_VariablenamingRules.md (DT suffix = date, FL = flag, etc.)
  - Return structured warnings for:
    * Invalid naming conventions
    * Missing required columns
    * Ambiguous derivation logic
  - Store parsed data in structured format (JSON) for reuse
```

#### **Frontend Tasks**

**1.4 Variables Analysis Tab Component**
```typescript
// File: frontend/src/components/tabs/VariablesAnalysisTab.tsx

Features:
  - Auto-trigger on spec upload completion (listen to store state)
  - Call POST /api/spec/categorize with specId
  - Display categorized variables in tabbed interface:
    * Each category = one tab (Identifiers, Treatment, Demographics, etc.)
    * Within tab: Grid/cards of variables with:
      - Variable name (bold)
      - Label (secondary text)
      - Type indicator (Num/Char badge)
      - Source dataset chip (DM, EX, etc.)
      - Derivation summary (collapsible)
      - Selection checkbox (required vars disabled+checked)
    * Search bar (filters across all categories)
    * "Select All" / "Deselect All" per category
  - Bottom action bar:
    * Variable count: "45/67 variables selected"
    * "Confirm Variables" button → updates store → enables next tab
  - Visual states:
    * Loading skeleton during categorization
    * Error state with retry for failed categorization
    * Warning badges for uncategorized variables

Store Integration:
  - Add to projectStore: 
    * categorizedVariables: CategorizedVariable[]
    * selectedVariableNames: string[]
    * variableAnalysisComplete: boolean
  - Completion check: variableAnalysisComplete = true when user confirms

Accessibility:
  - Tab keyboard navigation (ARIA tablist)
  - Focus management on category switch
  - Screen reader announcements for counts
```

**1.5 Update Tab Navigation**
```typescript
// File: frontend/src/components/LeftPanel.tsx

Changes:
  - Insert "Variables Analysis" tab after "Specification Upload"
  - Status badge logic:
    * complete: variableAnalysisComplete = true
    * incomplete: spec uploaded but variables not confirmed
    * not-started: spec not uploaded
  - Disable tab until spec upload completes
  - Progress percentage: Include in completion calculation (now 6 tabs)
```

---

### **PHASE 2: Enhanced Specification Workflow**

#### **2.1 Specification Upload Enhancement**
```typescript
// Update: frontend/src/components/tabs/SpecificationUploadTab.tsx

Post-Upload Flow:
  1. Upload file → backend saves
  2. Auto-trigger parse: POST /api/spec/parse
  3. Display parse results:
     - Variable count, dataset guess
     - Parsing warnings (collapsible panel)
  4. Auto-trigger categorization: POST /api/spec/categorize
  5. Show preview: "Found 67 variables in 8 categories"
  6. CTA: "Review Variables" → navigate to Variables Analysis tab

Enhanced Validation:
  - Check file has required columns before parse
  - Show inline errors for missing columns
  - Suggest column mappings if names don't match expected
```

#### **2.2 Variable Dependency Resolution**
```python
# File: backend/app/modules/variable_categorizer/dependency_resolver.py

Purpose: Build dependency graph for variables
Process:
  1. Parse derivation logic from spec (extract variable names)
  2. Identify dependencies (e.g., TRT01PN depends on TRT01P)
  3. Topologically sort for execution order
  4. Detect circular dependencies → error
Output: {
  execution_order: ["STUDYID", "USUBJID", "TRT01P", "TRT01PN", ...],
  dependency_graph: {variable: [dependencies]},
  circular_deps: [...]  # Should be empty
}

Integration:
  - Called during categorization
  - Exposed via GET /api/spec/{specId}/dependencies
  - Used in code generation to order variable creation
```

---

### **PHASE 3: Progressive User Confirmation Flow**

#### **3.1 Stage-Based Validation**
```python
# File: backend/app/modules/confirmation_tracker/progress_validator.py

Stages:
  1. Project Info: studyId, dataset type selected
  2. Spec Upload: File uploaded and parsed successfully
  3. Variables: Variables categorized and user-confirmed selection
  4. Standards: SDTM/ADaM/MedDRA versions selected
  5. Rules: Rule categories reviewed and enabled
  6. Ready: All stages complete → enable generation

Endpoint: GET /api/progress/validate
Returns: {
  overall_completion: 85,
  stages: [
    {name: "project", complete: true, percent: 100},
    {name: "variables", complete: false, percent: 60, 
     missing: ["User must confirm variable selection"]}
  ],
  can_generate: false,
  blockers: ["Variables not confirmed"]
}

Frontend Use:
  - Poll on tab change
  - Update progress bar
  - Show blockers in Generate tab if not ready
```

#### **3.2 Pre-Generation Summary Panel**
```typescript
// File: frontend/src/components/tabs/GenerateTab.tsx (enhance existing)

Before Generate Button:
  - Summary Section (collapsible cards):
    * Dataset: ADSL
    * Variables: 45 selected (with expandable list)
    * Standards: SDTM v2.0, ADaM IG v1.3, MedDRA v27.0
    * Rules: 12 enabled (grouped by category)
    * Language: R
  - Validation checklist:
    ✓ All required variables present
    ✓ No circular dependencies
    ⚠ 2 optional variables skipped
  - Estimated generation time: ~15 seconds
  - CTA: "Confirm & Generate Code"

Post-Generation:
  - Keep existing right panel (code, validation, docs)
  - Add: "Regenerate with Changes" button
```

---

### **PHASE 4: Dataset-Specific Context Assembly**

#### **4.1 Dataset Context Builder**
```python
# File: backend/app/modules/context_builder/dataset_context.py

Purpose: Build dataset-specific context for LLM
Process:
  1. Identify dataset type (ADSL/ADAE/ADLB from user selection)
  2. Load relevant rules from Context/ADAMRules/:
     - ADSL: Load ADSL_MacroLogic.md, ADSL_IGSpecificRules.md, 
             ADSL_ApplicationBehaviourRules.md
     - ADAE/ADLB: Similar pattern (create files as needed)
  3. Load input dataset requirements from ADSL_MacroLogic.md (DM, DS, EX, etc.)
  4. Filter variables by dataset relevance (ADSL doesn't need lab vars)
  5. Assemble context blocks:
     - Variable naming rules (from ADAM_VariablenamingRules.md)
     - IG-specific constraints
     - Macro logic (derivation sequence)
     - Standard references (SDTM/ADaM versions)

Output: Structured context dict for prompt builder
Integration: Called before prompt assembly in generate flow
```

#### **4.2 Rule Selector Service**
```python
# File: backend/app/modules/context_builder/rule_selector.py

Purpose: Select applicable rules based on dataset and variables
Process:
  1. Load all rules from Context/ADAMRules/*.md
  2. Filter by dataset type (some rules ADSL-only)
  3. Filter by selected variables (no need for treatment rules if no TRT vars)
  4. Prioritize enabled rules (from user selection in Rules tab)
  5. Group by category: Naming, IG Compliance, Macro Logic, etc.

Output: Filtered, prioritized rule set for prompt
Benefits:
  - Reduces prompt token count (only relevant rules)
  - Improves generation quality (focused context)
  - Enables dataset-specific rule libraries
```

---

### **PHASE 5: Backend API Completion**

#### **5.1 Core Endpoints (Summary)**
```
Existing (Enhance):
  POST /api/spec/upload       → Add validation for column mapping
  POST /api/spec/parse        → Add variable extraction and naming validation
  GET  /api/rules/adam/adsl   → Add rule categorization and filtering

New (Critical):
  POST /api/spec/categorize   → Categorize variables using VariablesMapping.xlsx
  GET  /api/spec/{id}/dependencies → Return dependency graph
  GET  /api/progress/validate → Return stage completion and blockers
  POST /api/generate/preview  → Dry-run generation (return summary, no LLM call)

Existing (Keep):
  POST /api/generate/code     → Main generation endpoint (add context assembly)
  POST /api/validate/code     → Static validation (future)
```

#### **5.2 Enhanced Generate Endpoint**
```python
# Enhance: POST /api/generate/code

New Flow:
  1. Validate request (all stages complete via progress_validator)
  2. Load specification and categorized variables
  3. Build dataset-specific context (dataset_context.py)
  4. Select applicable rules (rule_selector.py)
  5. Resolve variable dependencies (dependency_resolver.py)
  6. Assemble prompt (prompt_builder.py with enhanced templates)
  7. Call LLM (Gemini 2.5 Flash with structured output)
  8. Parse response (code + validation + derivation sequence)
  9. Validate generated code structure (variable count, syntax check)
  10. Return comprehensive response

Enhanced Response:
{
  code: "...",  # R or SAS code
  language: "R",
  validation_results: {
    syntax_valid: true,
    variables_created: ["STUDYID", "USUBJID", ...],
    missing_variables: [],
    warnings: ["TRT01PN not used in derivations"]
  },
  derivation_sequence: [
    {step: 1, variable: "STUDYID", source: "DM.STUDYID", logic: "Direct mapping"},
    ...
  ],
  metadata: {
    tokens_used: 4523,
    generation_time_ms: 12450,
    model: "gemini-2.5-flash",
    rules_applied: ["Variable Naming", "ADSL Macro Logic"]
  },
  documentation: {
    summary: "Generated ADSL with 45 variables...",
    input_datasets: ["DM", "DS", "EX"],
    assumptions: ["Treatment start date imputed from first EX record"],
    limitations: ["Requires SDTM v2.0 compliance"]
  }
}
```

---

### **PHASE 6: Frontend Polish & Integration**

#### **6.1 Store Enhancements**
```typescript
// Update: frontend/src/store/projectStore.ts

Add to ProjectStore:
  // Variables Analysis
  categorizedVariables: CategorizedVariable[] | null
  selectedVariableNames: string[]
  variableAnalysisComplete: boolean
  dependencyGraph: {[variable: string]: string[]} | null
  
  // Progress Tracking
  stageCompletions: {
    project: boolean
    specification: boolean
    variables: boolean
    standards: boolean
    rules: boolean
  }
  
  // Generation State
  generationSummary: GenerationSummary | null
  generationInProgress: boolean

Actions:
  setCategorizedVariables(vars: CategorizedVariable[])
  toggleVariableSelection(name: string)
  confirmVariableAnalysis()
  loadDependencyGraph(graph: object)
  updateStageCompletion(stage: string, complete: boolean)
```

#### **6.2 Completion Percentage Update**
```typescript
// Update calculation in projectStore.ts

New Formula (6 tabs):
  - Project Info: 15%
  - Dataset Selection: 10%
  - Specification Upload: 20%
  - Variables Analysis: 20%  ← NEW
  - Standards: 15%
  - Rules: 20%

Total = 100%
Generation enabled at ≥ 80% (all except Rules optional)
```

#### **6.3 Visual Consistency**
```css
/* Ensure Variables Analysis Tab matches design system */

Categories:
  - Use existing FormBlock component
  - Tab styling matches TabNavigation component
  - Variable cards use card component styles
  - Checkboxes use design tokens (--primary-600)

Responsive:
  - Grid layout for variable cards (3 cols desktop, 2 tablet, 1 mobile)
  - Sticky category tabs on scroll
  - Collapsible derivation previews
```

---

### **PHASE 7: Testing & Validation**

#### **7.1 Backend Tests**
```python
# Test Suite Structure

Unit Tests:
  - test_mapping_loader.py: VariablesMapping.xlsx parsing
  - test_categorizer.py: Variable categorization logic
  - test_dependency_resolver.py: Circular dependency detection
  - test_dataset_context.py: Context assembly per dataset
  - test_rule_selector.py: Rule filtering and prioritization

Integration Tests:
  - test_spec_flow.py: Upload → Parse → Categorize → Dependencies
  - test_generate_flow.py: Full generation with mocked LLM
  - test_validation_flow.py: Progress validation across stages

Acceptance Tests:
  - test_adsl_e2e.py: Full ADSL workflow with sample spec
  - test_edge_cases.py: Missing vars, invalid specs, circular deps
```

#### **7.2 Frontend Tests**
```typescript
// Test Suite Structure

Unit Tests:
  - VariablesAnalysisTab.test.tsx: Component rendering, interactions
  - projectStore.test.ts: Store actions and state updates
  - categorization.test.ts: Variable selection logic

Integration Tests:
  - spec-upload-flow.test.tsx: Upload → categorize → confirm
  - generation-flow.test.tsx: Complete workflow simulation
  - tab-navigation.test.tsx: Tab enabling/disabling logic

E2E Tests (Playwright):
  - adsl-workflow.spec.ts: Full user journey from landing to generation
  - variable-selection.spec.ts: Category navigation, search, selection
```

---

### **PHASE 8: Documentation & User Guidance**

#### **8.1 In-App Help**
```typescript
// Add contextual help throughout Variables Analysis

Components:
  - Tooltip on variable cards (explain type, source)
  - Collapsible "What are these categories?" panel
  - Inline help for required variables (why they're locked)
  - Empty state guidance if no variables match spec

Messages:
  - "These variables are required by ADaM IG v1.3"
  - "Dependencies: TRT01PN requires TRT01P to be selected"
  - "Uncategorized: 3 variables don't match standard naming"
```

#### **8.2 Error Messaging**
```typescript
// Clear, actionable error messages

Upload Errors:
  ✗ "Column 'Variable' not found. Expected columns: Variable, Label, Type, Source"
  → Action: "Download template" button

Categorization Errors:
  ⚠ "5 variables couldn't be categorized. They may use non-standard names."
  → Action: Show list, allow manual category assignment

Generation Blockers:
  ✗ "Cannot generate: 3 required variables not selected"
  → Action: Link to Variables Analysis tab with list highlighted
```

---

## Implementation Timeline

### **Sprint 1 (Week 1-2): Variables Analysis Foundation**
- Backend: Mapping loader, categorization endpoint, dependency resolver
- Frontend: Variables Analysis Tab component (basic version)
- Testing: Unit tests for categorization logic
- Milestone: Can upload spec and see categorized variables

### **Sprint 2 (Week 3-4): Integration & Enhancement**
- Backend: Enhanced spec parser, progress validator
- Frontend: Tab navigation updates, store enhancements
- Testing: Integration tests for full spec flow
- Milestone: Complete workflow from upload to variable confirmation

### **Sprint 3 (Week 5-6): Context Assembly & Generation**
- Backend: Dataset context builder, rule selector, enhanced generate endpoint
- Frontend: Pre-generation summary, improved Generate tab
- Testing: E2E tests with mocked LLM
- Milestone: Can generate code with proper context assembly

### **Sprint 4 (Week 7-8): Polish, Testing & Documentation**
- Backend: LLM integration (real Gemini calls), error handling
- Frontend: Visual polish, accessibility audit, help content
- Testing: Full E2E tests with real specs
- Milestone: Production-ready ADSL generation

---

## Risk Mitigation

### **Risk 1: VariablesMapping.xlsx Variability**
**Impact:** High  
**Mitigation:**
- Version VariablesMapping.xlsx (include version field)
- Provide mapping editor UI for admins (future)
- Fallback: If variable not in mapping, show in "Other" category
- Validation: Warn user of unmapped variables, allow manual assignment

### **Risk 2: Complex Dependency Graphs**
**Impact:** Medium  
**Mitigation:**
- Implement cycle detection with clear error messages
- Visualize dependency graph (optional, future)
- Allow user override of auto-detected dependencies
- Fallback: Generate in spec order if dependency resolution fails

### **Risk 3: LLM Output Variability**
**Impact:** Medium  
**Mitigation:**
- Use structured output mode (JSON schema)
- Post-process: Extract code blocks, validate structure
- Retry logic: If output malformed, retry with stricter prompt
- Fallback: Allow user to edit malformed code in UI

### **Risk 4: Performance with Large Specs**
**Impact:** Low  
**Mitigation:**
- Pagination: Show variables in batches (50 per page)
- Lazy loading: Load categories on-demand
- Backend caching: Cache parsed specs and categorizations
- Progress indicators: Show parsing/categorization progress

---

## Success Metrics

### **User Experience**
- ✓ Users can understand variable categories intuitively
- ✓ < 2 clicks to review all variables
- ✓ Clear indication of progress (completion percentage)
- ✓ Generation only possible when ready (no premature attempts)

### **Technical**
- ✓ Categorization: > 95% accuracy for standard variable names
- ✓ Performance: Categorization completes in < 3 seconds
- ✓ Robustness: Handle specs with up to 200 variables
- ✓ Test coverage: > 80% for critical paths

### **Business**
- ✓ Generated ADSL code compiles without syntax errors
- ✓ Variables created match specification (100% match)
- ✓ Code follows naming conventions per ADAM_VariablenamingRules.md
- ✓ No regressions in existing functionality

---

## Future Enhancements (Post-MVP)

1. **Variable Mapping Editor**
   - Admin UI to edit VariablesMapping.xlsx
   - Version control for mapping changes
   - A/B testing different categorizations

2. **Dependency Visualization**
   - Interactive graph showing variable dependencies
   - Highlight critical path for derivation order
   - Allow manual adjustment of execution order

3. **Smart Categorization**
   - ML model to suggest categories for unmapped variables
   - Learn from user corrections
   - Auto-update mapping from user patterns

4. **Template Library**
   - Pre-configured specs for common studies (Phase I, III, etc.)
   - Variable set templates (Oncology, Cardiology, etc.)
   - Quick-start workflows

5. **Collaborative Features**
   - Share specs and variable selections with team
   - Comments on specific variables
   - Approval workflow for generation

---

## Appendix: Key File Locations

### **Context Files (Reference)**
```
Context/
├── 0_MyRequirement_planner.md        # Original requirement (Variables Analysis)
├── My_Initial_Plan.md                 # Original plan (missing Variables Analysis)
├── My_Revised_Plan.md                 # This document
├── ADAMRules/
│   ├── ADAM_VariablenamingRules.md   # Naming conventions
│   ├── ADSL_ApplicationBehaviourRules.md # UI behavior rules
│   ├── ADSL_MacroLogic.md            # Programming flow
│   ├── ADSL_IGSpecificRules.md       # IG compliance rules
│   └── VariablesMapping.xlsx          # ★ Critical: Variable categories
└── ProjectArchitecture/
    ├── ProjectArchitecture.md         # Overall design principles
    └── ProjectRequirements.md         # Workflow and behavior spec
```

### **Frontend Files (Implementation)**
```
frontend/src/
├── components/
│   ├── LeftPanel.tsx                  # Update: Add Variables Analysis tab
│   └── tabs/
│       ├── SpecificationUploadTab.tsx # Enhance: Trigger categorization
│       ├── VariablesAnalysisTab.tsx   # ★ NEW: Main Variables Analysis UI
│       ├── GenerateTab.tsx            # Enhance: Add summary panel
│       └── VariablesTab.tsx           # ★ Replace with dynamic loading
└── store/
    └── projectStore.ts                # Update: Add variables state
```

### **Backend Files (Implementation)**
```
backend/app/
├── api/v1/
│   ├── specification.py               # Add: /categorize, /dependencies
│   └── progress.py                    # ★ NEW: /validate endpoint
└── modules/
    ├── variable_categorizer/          # ★ NEW MODULE
    │   ├── mapping_loader.py
    │   ├── categorizer.py
    │   └── dependency_resolver.py
    ├── context_builder/               # Enhance existing
    │   ├── dataset_context.py         # ★ NEW
    │   └── rule_selector.py           # ★ NEW
    └── confirmation_tracker/          # ★ NEW MODULE
        └── progress_validator.py
```

---

## Clarifications Needed (Before Implementation)

Please confirm or clarify the following before implementation begins:

### **1. VariablesMapping.xlsx Structure**
**Question:** What is the exact structure of VariablesMapping.xlsx?
- Column names: Category, Variable, Group, Priority, Description?
- How many categories are defined?
- Are there multiple sheets (one per dataset type)?

**Action Required:** Please share the file or describe its structure.

### **2. Variable Selection Behavior**
**Question:** For variables in the spec but not in VariablesMapping.xlsx:
- Should they appear in an "Uncategorized" category?
- Should user be allowed to manually assign category?
- Should generation be blocked if uncategorized variables exist?

**Assumption (if no answer):** Show in "Other" category, allow generation with warning.

### **3. Dependency Detection Logic**
**Question:** How should dependencies be detected?
- Parse derivation logic column for variable names?
- Use explicit "Dependencies" column in spec?
- Rely on VariablesMapping.xlsx for known dependencies?

**Assumption (if no answer):** Parse derivation logic column using regex to extract variable names.

### **4. Multiple Dataset Support Timeline**
**Question:** When should ADAE and ADLB support be added?
- In same sprint as ADSL?
- In future phases?

**Assumption (if no answer):** ADSL-only for Sprint 1-4, ADAE/ADLB in Phase 2 (Sprints 5-8).

### **5. Variable Card Detail Level**
**Question:** How much information should each variable card show?
- Minimal: Name, Label, Type
- Medium: + Source, Required flag
- Detailed: + Derivation logic preview, Dependencies

**Assumption (if no answer):** Medium level by default, derivation logic in collapsible section.

---

## Conclusion

This revised plan addresses all critical gaps identified in the initial plan:

✓ **Variables Analysis Page** – Full specification with tabbed UI  
✓ **VariablesMapping.xlsx Integration** – Backend service and endpoint  
✓ **Progressive Confirmation** – Stage-based validation and blockers  
✓ **Dataset-Specific Context** – Enhanced context assembly and rule selection  
✓ **Dependency Resolution** – Graph building and topological sorting  

The plan is structured for incremental delivery, with each sprint producing a testable milestone. All components are aligned with:
- ADSL_ApplicationBehaviourRules.md (categorized variable display)
- ProjectRequirements.md (stage-based workflow)
- ProjectArchitecture.md (domain-focused, user-friendly design)

**Next Step:** Await clarifications on the 5 questions above, then proceed with Sprint 1 implementation.
