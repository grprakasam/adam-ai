# Code Comparer Tab – Revised Implementation Plan
## Executive Summary

This revised plan enhances the initial implementation with industry best practices, improved UX patterns, and addresses critical gaps identified during review. The Code Comparer will be a **masterclass in code comparison**, leveraging Monaco DiffEditor, AI-powered analysis, and domain-specific insights for ADaM programmers.

### Key Enhancements Over Initial Plan:
1. **Industry-grade diff visualization** using Monaco DiffEditor with inline annotations
2. **Progressive disclosure UX** to avoid overwhelming users
3. **Smart comparison modes** (quick, standard, deep analysis)
4. **Enhanced accessibility** and keyboard navigation
5. **Context-aware ADaM domain insights** with CDISC rule mapping
6. **Export and sharing capabilities** for regulatory workflows
7. **Performance optimizations** for large programs
8. **Comprehensive error recovery** and graceful degradation

---

## 1. Objectives & Context

### 1.1 Vision
Build an **industry-leading Code Comparer** that becomes the gold standard for comparing ADaM programs, combining:
- Visual excellence of modern diff tools (GitHub, VS Code, Beyond Compare)
- Intelligence of AI-powered analysis
- Domain expertise for clinical trial programming

### 1.2 Success Criteria
- **Usability**: Users can compare two programs in <30 seconds
- **Clarity**: 95% of differences correctly categorized by severity and type
- **Trust**: Domain experts prefer this tool over manual comparison
- **Performance**: Sub-3-second response for typical 500-line programs
- **Accessibility**: WCAG 2.1 AA compliant

---

## 2. Scope & Non-Goals

### 2.1 In Scope (MVP with Enhancements)

**Core Functionality:**
- Dedicated Code Comparer tab under AI Utilities
- Import/paste support for SAS and R programs
- Side-by-side Monaco DiffEditor with synchronized scrolling
- Three comparison modes:
  1. **Quick Compare** (static diff only, <1s)
  2. **Standard Compare** (diff + basic AI categorization, <5s)
  3. **Deep Analysis** (full AI + domain mapping, <15s)

**Advanced Features:**
- **Smart difference categorization**:
  - Critical: Output-altering logic changes
  - Important: Derivation rule differences
  - Minor: Style/formatting differences
  - Informational: Comments, whitespace
- **Domain-aware insights**:
  - Map differences to CDISC ADaM variables (e.g., "This affects AVAL derivation")
  - Identify common patterns (baseline flags, treatment-emergent rules)
  - Flag potential compliance issues
- **Interactive features**:
  - Click difference to jump to location
  - Filter by severity/category
  - "Show only differences" toggle
  - Difference navigator (prev/next buttons)
- **Export capabilities**:
  - PDF comparison report
  - HTML snapshot for documentation
  - JSON diff data for programmatic access

**Sample Programs:**
- 4 curated examples (2 R + 2 SAS):
  - Nearly identical code (>95% similar)
  - Minor refactoring (70-90% similar)
  - Functional differences (<70% similar)
  - Cross-language comparison (R vs SAS for same derivation)

### 2.2 Out of Scope (Future Phases)

- Real-time collaborative comparison
- Multi-way comparison (>2 programs)
- Automated merge suggestions
- Version control integration (Git, SVN)
- Comparison history and audit trail (Phase 2)
- Three-way merge conflict resolution

### 2.3 Gaps Addressed from Initial Plan

| Gap Identified | Solution |
|----------------|----------|
| No keyboard navigation mentioned | Full keyboard shortcuts (Alt+N/P for next/prev diff, Ctrl+D to toggle inline) |
| Missing progressive disclosure | Collapsible sections, smart defaults, "Show only differences" mode |
| No export/sharing capabilities | PDF report, HTML snapshot, shareable links |
| Limited error handling details | Comprehensive error states, partial results on LLM failure |
| No performance strategy for large files | Virtualization, diff chunking, progressive rendering |
| Accessibility not addressed | ARIA labels, screen reader support, high contrast mode |
| No user testing validation | Validation checklist and acceptance criteria added |

---

## 3. User Personas & Enhanced User Flows

### 3.1 Personas (Expanded)

1. **ADaM Developer** (Primary)
   - Needs: Quick validation that QC code is functionally equivalent
   - Pain points: Manual line-by-line review is time-consuming and error-prone
   - Success: Can approve QC code with confidence in <5 minutes

2. **QC Programmer/Reviewer** (Primary)
   - Needs: Understand how their code differs from production code
   - Pain points: Unclear which differences are acceptable vs problematic
   - Success: Clear guidance on which differences require discussion

3. **Lead Statistician** (Secondary)
   - Needs: High-level assurance of code alignment without reading code
   - Pain points: Lacks programming expertise to review code directly
   - Success: Can read executive summary and trust similarity scores

4. **Regulatory Reviewer** (Future)
   - Needs: Documented evidence of independent QC
   - Pain points: Manual comparison reports are inconsistent
   - Success: Standardized comparison report for submission package

### 3.2 Primary User Flows (Enhanced)

#### Flow 1: Quick Ad-Hoc Comparison (90% of use cases)
```
1. User clicks "Code Comparer" from Landing Page or Workspace Navigation
2. Page loads with empty editors and "Get Started" guide
3. User pastes Developer code (left) and QC code (right)
   - Auto-detect language (SAS/R) or manual selection
4. User clicks "Compare" (default: Standard mode)
5. Within 3-5 seconds:
   - DiffEditor highlights all differences
   - Summary card shows: 87% similar, 3 critical, 5 minor differences
   - Top 3 most important differences shown expanded
6. User clicks "Show only differences" toggle
   - Editors collapse to show only changed sections
7. User clicks critical difference #1
   - Both editors jump to line 142
   - Difference detail panel explains: "Baseline flag condition differs: `ABLFL == 'Y'` vs `ABLFL == 1`"
8. User navigates through differences with Alt+N shortcut
9. User exports PDF report for documentation
10. Done ✓
```

**Time to completion: 2-3 minutes** (vs 15-30 minutes manually)

#### Flow 2: Deep Domain Analysis (10% of use cases)
```
1-4. [Same as Flow 1]
5. User selects "Deep Analysis" mode and clicks "Compare"
6. Progress indicator shows: "Analyzing syntax... Categorizing differences... Mapping to ADaM domains..."
7. Within 10-15 seconds:
   - All features from Standard mode PLUS:
   - ADaM-specific insights: "This difference affects ADSL.SAFFL derivation"
   - CDISC rule mapping: "Related to ADaM IG Section 3.2.1"
   - Common pattern detection: "Both use treatment-emergent logic (TRTEMFL)"
8. User reviews domain narrative in expandable panel
9. User filters to show only "CDISC-relevant" differences
10. User exports enhanced PDF with ADaM context
```

**Time to completion: 5-8 minutes** (provides regulatory-grade documentation)

#### Flow 3: Learning with Samples
```
1. User opens Code Comparer (first time, no study loaded)
2. Welcome screen shows "Try an Example" section
3. User clicks "R Example: Baseline Flag Derivation"
4. Both editors auto-populate with curated R code
5. Comparison auto-runs in Standard mode
6. Interactive tutorial overlay highlights key features:
   - "Green = added lines, Red = removed, Blue = modified"
   - "Click any difference to see details"
   - "Try navigating with Alt+N/Alt+P"
7. User explores sample, builds mental model
8. User clicks "Clear" and starts their own comparison
```

**Onboarding time: <2 minutes**

---

## 4. UX & Interaction Design (Industry Best Practices)

### 4.1 Layout Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ [Header Bar]                                                    │
│ Code Comparer | Compare SAS/R programs for ADaM datasets       │
│                                        [Mode: Standard ▼] [⚙️]  │
├─────────────────────────────────────────────────────────────────┤
│ [Context Bar - Optional]                                        │
│ 📁 Study: STUDY123 | Dataset: ADSL | 3 Critical Differences    │
├──────────────────────────────┬──────────────────────────────────┤
│                              │                                  │
│  Code 1: Developer           │  Code 2: QC                      │
│  [R ▼] [📋 Paste] [📂 Upload]│  [R ▼] [📋 Paste] [📂 Upload]    │
│  ┌────────────────────────┐  │  ┌────────────────────────┐      │
│  │                        │  │  │                        │      │
│  │  Monaco DiffEditor     │◄─┼─►│  (Synchronized)        │      │
│  │  (Original side)       │  │  │  (Modified side)       │      │
│  │                        │  │  │                        │      │
│  │                        │  │  │                        │      │
│  └────────────────────────┘  │  └────────────────────────┘      │
│                              │                                  │
├──────────────────────────────┴──────────────────────────────────┤
│ [Action Bar]                                                    │
│  ☑️ Show only differences   [◀️ Prev] [▶️ Next]  [🔄 Compare]  │
├─────────────────────────────────────────────────────────────────┤
│ [Results Panel - Collapsible sections]                          │
│                                                                 │
│  ▼ Summary (Always expanded by default)                        │
│     🎯 87% Similar | ⚠️ 3 Critical | ℹ️ 5 Minor                  │
│                                                                 │
│  ▼ Top Differences (Top 3 auto-expanded)                       │
│     1. ⚠️ Critical: Baseline flag logic differs (Line 142)     │
│        "Developer uses ABLFL == 'Y', QC uses ABLFL == 1"       │
│     2. ⚠️ Critical: Missing WHERE clause in QC (Line 89)       │
│     3. ℹ️ Minor: Variable naming: base_dt vs baseline_dt       │
│                                                                 │
│  ▶️ All Differences (12 total) - Click to expand                │
│  ▶️ ADaM Domain Insights - Click to expand                      │
│  ▶️ Syntax Issues (2) - Click to expand                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Color Coding & Visual Language

**Diff Highlighting (Monaco Standard + Enhancements):**
- 🟢 **Green background**: Lines added in Code 2
- 🔴 **Red background**: Lines removed from Code 1
- 🔵 **Blue outline**: Lines modified (changed content)
- 🟡 **Yellow highlight**: Character-level changes within modified lines
- ⚪ **Gray text**: Identical lines (dimmed when "Show only differences" enabled)

**Severity Indicators:**
- 🔴 **Critical** (Red badge): Output-altering differences
- 🟠 **Important** (Orange badge): Logic differences, potential issues
- 🔵 **Minor** (Blue badge): Style, naming, non-functional changes
- ⚪ **Informational** (Gray badge): Comments, whitespace

**Accessibility:**
- All colors have 4.5:1 contrast ratio minimum
- Icons paired with text labels
- Pattern fills for colorblind users (e.g., diagonal stripes for critical)

### 4.3 Comparison Modes (Smart Defaults)

| Mode | Speed | LLM Used | Use Case |
|------|-------|----------|----------|
| **Quick** | <1s | No | Just show me the diff |
| **Standard** (Default) | 3-5s | Light | Categorize differences, basic insights |
| **Deep Analysis** | 10-15s | Full | ADaM domain mapping, regulatory context |

**Progressive Enhancement:**
- All modes show immediate visual diff
- AI analysis loads progressively (don't block diff rendering)
- "Deep Analysis" can be triggered after Standard if needed

### 4.4 Interactive Features

**Difference Navigation:**
- **Next/Previous buttons**: Navigate through differences in document order
- **Keyboard shortcuts**:
  - `Alt+N` / `Alt+P`: Next/Previous difference
  - `Ctrl+D`: Toggle "Show only differences"
  - `Ctrl+F`: Find in both files
  - `Escape`: Close detail panels
- **Jump-to-line**: Click difference in results panel → both editors scroll to location

**Filtering & Grouping:**
- Filter by severity: [All] [Critical] [Important] [Minor]
- Filter by type: [All] [Functional] [Logical] [Syntax] [Style]
- Group by: [Location] [Severity] [Type] [ADaM Domain]

**Expandable Sections:**
- Summary: Always expanded
- Top 3 Differences: Expanded by default
- All Differences: Collapsed initially
- ADaM Insights: Collapsed initially
- Syntax Issues: Expanded only if issues found

### 4.5 Monaco DiffEditor Configuration

**Implementation Details:**
```typescript
import { DiffEditor } from '@monaco-editor/react';

<DiffEditor
  original={code1}
  modified={code2}
  language={detectedLanguage}
  theme="vs-light" // or "vs-dark" based on app theme
  options={{
    renderSideBySide: true, // Side-by-side view
    readOnly: true, // No editing in compare mode
    renderOverviewRuler: true, // Minimap with diff indicators
    scrollBeyondLastLine: false,
    fontSize: 13,
    minimap: { enabled: true },
    wordWrap: 'off',
    diffWordWrap: 'off',

    // Enhanced diff features
    enableSplitViewResizing: true, // User can resize panes
    renderIndicators: true, // Show +/- indicators
    ignoreTrimWhitespace: ignoreWhitespaceOption,

    // Accessibility
    accessibilitySupport: 'on',
    ariaLabel: 'Code comparison editor',
  }}
  onMount={(editor) => {
    // Get access to both editors
    const originalEditor = editor.getOriginalEditor();
    const modifiedEditor = editor.getModifiedEditor();

    // Setup diff navigator for keyboard shortcuts
    const diffNavigator = monaco.editor.createDiffNavigator(editor, {
      followsCaret: true,
      ignoreCharChanges: true,
    });

    // Add custom keybindings
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyN, () => {
      diffNavigator.next();
    });

    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyP, () => {
      diffNavigator.previous();
    });
  }}
/>
```

**Fallback Strategy:**
- If DiffEditor fails to load: Fall back to two separate Editor instances
- Manually overlay diff decorations using Monaco's decoration API
- Maintain same UX with custom implementation

### 4.6 Sample Programs (Curated Examples)

**Sample 1: R - Nearly Identical (95% similar)**
```r
# Developer Code
adsl <- sdtm$dm %>%
  mutate(
    SAFFL = if_else(!is.na(RFSTDTC), "Y", "N"),
    ITTFL = if_else(ARMCD != "SCRNFAIL", "Y", "N")
  )

# QC Code (style difference only)
adsl <- sdtm$dm %>%
  mutate(
    SAFFL = ifelse(!is.na(RFSTDTC), "Y", "N"),  # Different function
    ITTFL = ifelse(ARMCD != "SCRNFAIL", "Y", "N")
  )
```
**Expected Output:** 95% similar, 1 minor difference (if_else vs ifelse)

**Sample 2: SAS - Functional Difference (65% similar)**
```sas
/* Developer Code */
data adsl;
  set sdtm.dm;
  if rfstdtc ne '' then saffl = 'Y';
  else saffl = 'N';
run;

/* QC Code */
data adsl;
  set sdtm.dm;
  saffl = 'N';  /* Missing: Reversed logic! */
  if rfstdtc = '' then saffl = 'Y';
run;
```
**Expected Output:** 65% similar, 1 critical difference (reversed boolean logic)

**Sample 3: R - Logic Difference (72% similar)**
```r
# Baseline flag: Different window definitions
# Developer: Last pre-dose value
# QC: Closest to Day 1
```

**Sample 4: Cross-Language (SAS vs R)**
```r
# Same derivation, different languages
# Test AI's ability to detect functional equivalence
```

---

## 5. Functional Requirements (Enhanced)

### 5.1 Input Validation

**Required Inputs:**
- `code_1: string` (1 to 50,000 characters)
- `code_2: string` (1 to 50,000 characters)

**Optional Inputs:**
- `language_1, language_2`: `"sas" | "r" | "auto"`
- `comparison_mode`: `"quick" | "standard" | "deep"`
- `options`:
  - `ignore_whitespace: boolean` (default: true)
  - `ignore_comments: boolean` (default: false)
  - `case_sensitive: boolean` (default: false for SAS, true for R)
- `context` (for deep analysis):
  - `study_id: string`
  - `dataset: string` (e.g., ADSL, ADAE)

**Validation Rules:**
- Reject if both codes are empty
- Warn if codes are identical (offer to cancel comparison)
- Limit to 50,000 chars per side (~2000 lines) for MVP
- For larger files: Offer to compare in chunks or export for offline comparison

### 5.2 Output Schema (Comprehensive)

```typescript
interface CodeComparisonResult {
  // High-level scores
  overall_similarity_score: number; // 0-100
  classification_label: "Very similar" | "Similar with differences" |
                        "Moderately different" | "Significantly different";

  // Subscores
  subscores: {
    code_similarity: number; // Static diff ratio (0-100)
    functional_equivalence: number; // AI assessment (0-100)
    logical_alignment: number; // Same intent, different approach (0-100)
    syntax_quality: number; // Both codes syntactically valid (0-100)
  };

  // Executive summary
  summary: {
    total_differences: number;
    critical_count: number;
    important_count: number;
    minor_count: number;
    executive_narrative: string; // 2-3 sentence summary
  };

  // Categorized differences
  differences: Difference[];

  // Domain insights (Deep Analysis mode only)
  adam_insights?: {
    affected_variables: string[]; // e.g., ["SAFFL", "ITTFL"]
    cdisc_rules_referenced: string[]; // e.g., ["ADaM IG 3.2.1"]
    common_patterns_detected: string[]; // e.g., ["Treatment-emergent logic"]
    potential_compliance_issues: ComplianceIssue[];
  };

  // Syntax issues
  syntax_issues: SyntaxIssue[];

  // Metadata
  metadata: {
    comparison_mode: "quick" | "standard" | "deep";
    language_1: string;
    language_2: string;
    execution_time_ms: number;
    llm_used: boolean;
  };
}

interface Difference {
  id: string;
  type: "functional" | "logical" | "syntax" | "style" | "comment";
  severity: "critical" | "important" | "minor" | "informational";

  // Location
  code1_span: { start_line: number; end_line: number; } | null;
  code2_span: { start_line: number; end_line: number; } | null;

  // Description
  title: string; // "Baseline flag logic differs"
  summary: string; // One-liner
  details?: string; // Longer explanation

  // ADaM context (Deep Analysis only)
  adam_context?: {
    affected_variables: string[];
    impact_description: string;
  };

  // Suggested action
  recommendation?: "Review required" | "Acceptable difference" | "Fix QC code";
}

interface SyntaxIssue {
  side: "code1" | "code2";
  line: number;
  severity: "error" | "warning";
  message: string;
  code_snippet?: string;
}

interface ComplianceIssue {
  rule_id: string; // e.g., "CDISC-ADAM-3.2.1"
  description: string;
  affected_code_side: "code1" | "code2" | "both";
}
```

---

## 6. Frontend Architecture (Best Practices)

### 6.1 Component Hierarchy

```
CodeComparerTab/ (Main Container)
├── CodeComparerHeader
│   ├── Title & Subtitle
│   ├── Context Tags (Study, Dataset)
│   └── Mode Selector & Settings
├── CodeComparerEditors
│   ├── EditorToolbar (Left)
│   │   ├── Language Selector
│   │   ├── Paste Button
│   │   ├── Upload Button
│   │   └── Load Sample Menu
│   ├── DiffEditorWrapper
│   │   └── Monaco DiffEditor
│   ├── EditorToolbar (Right)
│   └── DiffNavigator (Prev/Next)
├── CodeComparerActionBar
│   ├── Compare Button
│   ├── Mode Selector
│   ├── Show Only Differences Toggle
│   └── Progress Indicator
├── CodeComparerResults
│   ├── SummaryCard
│   │   ├── Similarity Score Gauge
│   │   ├── Difference Counts
│   │   └── Executive Narrative
│   ├── TopDifferences (Auto-expanded)
│   ├── AllDifferencesList (Collapsible)
│   │   ├── DifferenceFilter
│   │   └── DifferenceItem (clickable)
│   ├── AdamInsightsPanel (Collapsible, Deep mode only)
│   └── SyntaxIssuesPanel (Collapsible)
└── CodeComparerExport
    ├── Export PDF Button
    ├── Export HTML Button
    └── Copy Shareable Link
```

### 6.2 State Management

**Component State (`CodeComparerTab.tsx`):**
```typescript
interface CodeComparerState {
  // Input state
  code1: string;
  code2: string;
  language1: Language;
  language2: Language;

  // Comparison options
  comparisonMode: "quick" | "standard" | "deep";
  ignoreWhitespace: boolean;
  ignoreComments: boolean;
  caseSensitive: boolean;

  // UI state
  isComparing: boolean;
  showOnlyDifferences: boolean;
  activeDifferenceId: string | null;

  // Results
  result: CodeComparisonResult | null;
  error: ApiError | null;

  // Export state
  isExporting: boolean;
  exportFormat: "pdf" | "html" | "json";
}
```

**Why Component State (Not Zustand):**
- Comparison is session-based, no need for global persistence
- Keep state management simple for MVP
- Can migrate to Zustand in Phase 2 if history/sharing features added

**State Transitions:**
```
EMPTY → READY → COMPARING → SUCCESS → RESULT_DISPLAYED
                     ↓
                   ERROR → READY (retry)
```

### 6.3 API Integration

**New API Method (`api.ts`):**
```typescript
export const compareCode = async (
  request: CodeComparisonRequest
): Promise<CodeComparisonResult> => {
  try {
    const response = await apiClient.post('/code-comparer/analyze', request);
    return response.data;
  } catch (error) {
    // Map backend errors to user-friendly messages
    if (error.response?.status === 413) {
      throw new Error('Code too large. Please limit to 2000 lines per file.');
    }
    if (error.response?.status === 400) {
      throw new Error(error.response.data.detail || 'Invalid input');
    }
    if (error.response?.status === 503) {
      throw new Error('Analysis service temporarily unavailable. Showing basic diff only.');
    }
    throw error;
  }
};
```

**Error Handling Strategy:**
- **Partial success**: If static diff works but LLM fails, show diff + warning
- **Complete failure**: Clear error message with retry button
- **Timeout**: After 30s, offer to cancel or continue waiting

### 6.4 Performance Optimizations

**Large File Handling:**
1. **Virtualization**: Use `react-window` for difference list (1000+ differences)
2. **Diff Chunking**: For files >1000 lines, process diff in chunks
3. **Progressive Rendering**:
   - Render visual diff immediately
   - Load AI analysis in background
   - Update UI as results arrive
4. **Web Worker**: Offload diff computation to Web Worker (future)

**Monaco Optimizations:**
```typescript
options={{
  // Limit expensive features for large files
  minimap: { enabled: code1.length < 10000 },
  renderValidationDecorations: 'off', // Disable for performance
  quickSuggestions: false,
  parameterHints: { enabled: false },
}}
```

### 6.5 Accessibility (WCAG 2.1 AA)

**Keyboard Navigation:**
- All interactive elements accessible via Tab
- Difference navigation: Alt+N/P
- Toggle features: Ctrl+D, Ctrl+F
- Escape to close panels

**Screen Reader Support:**
```tsx
<div role="region" aria-label="Code comparison results">
  <div role="status" aria-live="polite">
    {isComparing ? "Comparing code..." : `Comparison complete. ${result.summary.total_differences} differences found.`}
  </div>

  <button
    onClick={handleNextDifference}
    aria-label="Navigate to next difference"
    aria-keyshortcuts="Alt+N"
  >
    Next
  </button>
</div>
```

**Visual Accessibility:**
- High contrast mode support
- Minimum 13px font size in editors
- 4.5:1 color contrast for all text
- Focus indicators on all interactive elements

---

## 7. Backend Architecture (Robust & Scalable)

### 7.1 API Endpoint Design

**New Router: `backend/app/api/v1/endpoints/code_comparer.py`**

```python
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.schemas.code_comparer import CodeComparisonRequest, CodeComparisonResult
from app.services.code_comparer_service import CodeComparerService

router = APIRouter(prefix="/code-comparer", tags=["code-comparer"])

@router.post("/analyze", response_model=CodeComparisonResult)
async def analyze_code_comparison(
    request: CodeComparisonRequest,
    background_tasks: BackgroundTasks,
):
    """
    Compare two code snippets and return detailed analysis.

    - **Quick mode**: <1s, static diff only
    - **Standard mode**: 3-5s, diff + AI categorization
    - **Deep mode**: 10-15s, full AI + domain mapping
    """
    try:
        service = CodeComparerService()
        result = await service.compare(request)

        # Log analytics in background (non-blocking)
        background_tasks.add_task(
            log_comparison_analytics,
            result.metadata,
            request.context,
        )

        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except TimeoutError:
        raise HTTPException(status_code=503, detail="Analysis timeout. Try Quick mode.")
    except Exception as e:
        logger.error(f"Code comparison failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

### 7.2 Service Layer Design

**`backend/app/services/code_comparer_service.py`**

```python
class CodeComparerService:
    """
    Orchestrates code comparison pipeline:
    1. Preprocessing & validation
    2. Static diff computation
    3. Syntax checking
    4. AI-powered categorization (optional)
    5. ADaM domain mapping (Deep mode only)
    """

    async def compare(self, request: CodeComparisonRequest) -> CodeComparisonResult:
        # 1. Preprocess
        code1_norm, code2_norm = self._preprocess(
            request.code_1,
            request.code_2,
            request.options
        )

        # 2. Static diff (always runs, <1s)
        diff_result = self._compute_diff(code1_norm, code2_norm)
        similarity_score = diff_result.similarity_ratio * 100

        # 3. Syntax check (parallel, <500ms)
        syntax_issues = await asyncio.gather(
            self._check_syntax(request.code_1, request.language_1),
            self._check_syntax(request.code_2, request.language_2),
        )

        # 4. AI categorization (Standard & Deep modes)
        if request.comparison_mode in ["standard", "deep"]:
            differences = await self._categorize_with_ai(
                diff_result,
                request.language_1,
                request.language_2
            )
        else:
            differences = self._basic_categorization(diff_result)

        # 5. ADaM domain mapping (Deep mode only)
        adam_insights = None
        if request.comparison_mode == "deep" and request.context:
            adam_insights = await self._analyze_adam_domain(
                differences,
                request.context.study_id,
                request.context.dataset,
            )

        # 6. Assemble result
        return CodeComparisonResult(
            overall_similarity_score=similarity_score,
            classification_label=self._classify_similarity(similarity_score),
            subscores=self._compute_subscores(diff_result, differences),
            summary=self._generate_summary(differences),
            differences=differences,
            adam_insights=adam_insights,
            syntax_issues=syntax_issues,
            metadata=self._build_metadata(request),
        )
```

### 7.3 AI Integration Strategy

**Prompt Engineering for Categorization:**
```python
async def _categorize_with_ai(
    self,
    diff_result: DiffResult,
    lang1: str,
    lang2: str
) -> List[Difference]:
    """
    Use LLM to categorize each difference by:
    - Type: functional, logical, syntax, style
    - Severity: critical, important, minor
    - Impact: what changes in behavior
    """

    # Prepare context for LLM
    prompt = f"""
You are an expert {lang1}/{lang2} code reviewer specializing in clinical trial data programming (CDISC ADaM).

Compare these two code snippets:

CODE 1 (Developer):
{diff_result.code1_context}

CODE 2 (QC):
{diff_result.code2_context}

DIFFERENCES DETECTED:
{diff_result.diff_hunks}

For each difference, provide:
1. Type: functional (changes output), logical (different approach), style (formatting), or comment
2. Severity: critical (must fix), important (should review), minor (acceptable)
3. Title: Brief description (max 50 chars)
4. Summary: One sentence explanation
5. Recommendation: "Review required", "Acceptable difference", or "Fix QC code"

Output as JSON array.
"""

    # Use existing LLM integration with retry logic
    llm_response = await self.llm_service.generate(
        prompt=prompt,
        model="gpt-4o-mini",  # Fast, accurate for categorization
        temperature=0.1,  # Deterministic
        timeout=10,  # 10s max
    )

    return self._parse_llm_categorization(llm_response)
```

**Graceful Degradation:**
- If LLM times out: Return static diff-based categorization
- If LLM returns invalid JSON: Fall back to heuristics
- Never fail the entire comparison due to AI failure

### 7.4 Static Analysis Modules

**Diff Computation (`diff_engine.py`):**
```python
import difflib
from dataclasses import dataclass

@dataclass
class DiffResult:
    similarity_ratio: float  # 0.0 to 1.0
    diff_hunks: List[DiffHunk]
    total_lines_1: int
    total_lines_2: int
    added_lines: int
    removed_lines: int
    modified_lines: int

class DiffEngine:
    def compute(self, code1: str, code2: str) -> DiffResult:
        """Compute detailed diff using Python's difflib."""
        lines1 = code1.splitlines()
        lines2 = code2.splitlines()

        # Compute similarity
        matcher = difflib.SequenceMatcher(None, code1, code2)
        similarity = matcher.ratio()

        # Get diff hunks
        diff = difflib.unified_diff(lines1, lines2, lineterm='')
        hunks = self._parse_unified_diff(diff)

        return DiffResult(
            similarity_ratio=similarity,
            diff_hunks=hunks,
            total_lines_1=len(lines1),
            total_lines_2=len(lines2),
            added_lines=sum(1 for h in hunks if h.type == 'add'),
            removed_lines=sum(1 for h in hunks if h.type == 'remove'),
            modified_lines=sum(1 for h in hunks if h.type == 'change'),
        )
```

**Syntax Checker (`syntax_checker.py`):**
```python
class SyntaxChecker:
    """Lightweight syntax validation (no code execution)."""

    async def check_r(self, code: str) -> List[SyntaxIssue]:
        """Check R code for basic syntax errors."""
        issues = []

        # Check balanced brackets
        if not self._is_balanced(code, ['(', ')'], ['[', ']'], ['{', '}']):
            issues.append(SyntaxIssue(
                line=self._find_unbalanced_line(code),
                severity="error",
                message="Unbalanced brackets/parentheses",
            ))

        # Check unclosed strings
        if self._has_unclosed_strings(code):
            issues.append(SyntaxIssue(
                line=self._find_unclosed_string_line(code),
                severity="error",
                message="Unclosed string literal",
            ))

        # Optional: Use R parser in subprocess (isolated)
        # Only if available and safe

        return issues

    async def check_sas(self, code: str) -> List[SyntaxIssue]:
        """Check SAS code for basic syntax errors."""
        issues = []

        # Check for missing semicolons
        lines = code.splitlines()
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped and not stripped.endswith(';') and \
               not stripped.endswith('/*') and \
               not stripped.startswith('/*') and \
               not stripped.startswith('*'):
                # Heuristic: likely missing semicolon
                issues.append(SyntaxIssue(
                    line=i + 1,
                    severity="warning",
                    message="Possible missing semicolon",
                ))

        return issues
```

### 7.5 ADaM Domain Analyzer (Deep Mode)

**`adam_domain_analyzer.py`:**
```python
class AdamDomainAnalyzer:
    """
    Maps code differences to ADaM domain concepts:
    - Which ADaM variables are affected?
    - Which CDISC rules apply?
    - What are common patterns in ADaM programming?
    """

    async def analyze(
        self,
        differences: List[Difference],
        study_id: str,
        dataset: str,
    ) -> AdamInsights:
        # 1. Extract variable names from diff spans
        affected_vars = self._extract_adam_variables(differences)

        # 2. Map to CDISC rules (use existing rules engine)
        cdisc_rules = await self._map_to_cdisc_rules(
            affected_vars,
            dataset
        )

        # 3. Detect common ADaM patterns
        patterns = self._detect_patterns(differences)

        # 4. Check for compliance issues
        compliance_issues = await self._check_compliance(
            differences,
            dataset,
        )

        return AdamInsights(
            affected_variables=affected_vars,
            cdisc_rules_referenced=cdisc_rules,
            common_patterns_detected=patterns,
            potential_compliance_issues=compliance_issues,
        )

    def _detect_patterns(self, differences: List[Difference]) -> List[str]:
        """Detect common ADaM programming patterns."""
        patterns = []

        # Look for treatment-emergent logic
        if self._mentions_pattern(differences, ['TRTEMFL', 'RFSTDTC', 'RFENDTC']):
            patterns.append("Treatment-emergent event logic")

        # Look for baseline flag derivation
        if self._mentions_pattern(differences, ['ABLFL', 'baseline', 'pre-dose']):
            patterns.append("Baseline flag derivation")

        # Look for analysis value derivation
        if self._mentions_pattern(differences, ['AVAL', 'BASE', 'CHG']):
            patterns.append("Analysis value (AVAL/CHG) derivation")

        return patterns
```

### 7.6 Performance & Reliability

**Timeouts & Async Execution:**
```python
# Set timeouts per stage
TIMEOUT_DIFF = 2  # seconds
TIMEOUT_SYNTAX = 1  # seconds
TIMEOUT_AI_CATEGORIZATION = 10  # seconds
TIMEOUT_ADAM_ANALYSIS = 15  # seconds

async def compare(self, request):
    try:
        # Static diff must complete quickly
        diff_result = await asyncio.wait_for(
            self._compute_diff(...),
            timeout=TIMEOUT_DIFF,
        )

        # AI categorization can take longer
        try:
            differences = await asyncio.wait_for(
                self._categorize_with_ai(...),
                timeout=TIMEOUT_AI_CATEGORIZATION,
            )
        except asyncio.TimeoutError:
            logger.warning("AI categorization timeout, using heuristics")
            differences = self._basic_categorization(diff_result)

        # Return partial results if any stage fails
        return CodeComparisonResult(...)

    except asyncio.TimeoutError:
        raise TimeoutError("Comparison exceeded maximum time")
```

**Caching Strategy:**
```python
# Cache results for identical inputs (1 hour TTL)
@lru_cache(maxsize=100)
def _compute_diff_cached(self, code1_hash: str, code2_hash: str):
    # Actual diff computation
    pass

# Hash inputs for cache key
def compare(self, request):
    code1_hash = hashlib.sha256(request.code_1.encode()).hexdigest()
    code2_hash = hashlib.sha256(request.code_2.encode()).hexdigest()

    return self._compute_diff_cached(code1_hash, code2_hash)
```

---

## 8. Integration with Existing System

### 8.1 Frontend Integration Points

**RightPanel.tsx:**
```typescript
// Add new tab content rendering
case 'code-comparer':
  return <CodeComparerTab />;
```

**WorkspaceNavigation.tsx:**
- Already configured with Code Comparer link ✓
- Ensure icon matches design (use `<HighlightOutlined />`)

**LandingPage.tsx:**
- Already has Code Comparer card ✓
- Update click handler:
```typescript
const handleUtilityClick = (path: string) => {
  if (path === '/code-comparer') {
    // Initialize demo workspace if needed
    if (!currentStudy) {
      dispatch({ type: 'INIT_DEMO_WORKSPACE' });
    }
    // Navigate to workspace and activate Code Comparer
    navigate('/workspace');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('adam-ai:navigate-workspace', {
        detail: { path: '/code-comparer' }
      }));
    }, 100);
  }
};
```

### 8.2 Backend Integration

**Register router in `backend/app/api/v1/__init__.py`:**
```python
from app.api.v1.endpoints import code_comparer

api_router = APIRouter()
api_router.include_router(code_comparer.router)
```

**Reuse existing services:**
- `llm_integration`: For AI-powered categorization
- `adam_rules`: For CDISC rule mapping
- `validation`: For syntax checking

### 8.3 Feature Flag

**Environment Variable:**
```env
# .env
CODE_COMPARER_ENABLED=true
CODE_COMPARER_DEFAULT_MODE=standard
CODE_COMPARER_MAX_FILE_SIZE=50000
```

**Frontend Check:**
```typescript
const CODE_COMPARER_ENABLED = import.meta.env.VITE_CODE_COMPARER_ENABLED !== 'false';

// In RightPanel
case 'code-comparer':
  return CODE_COMPARER_ENABLED
    ? <CodeComparerTab />
    : <PlaceholderMessage message="Code Comparer coming soon!" />;
```

---

## 9. Export & Sharing Features

### 9.1 PDF Report Generation

**Backend Endpoint:**
```python
@router.post("/export/pdf")
async def export_comparison_pdf(
    result: CodeComparisonResult,
    options: PdfExportOptions,
):
    """Generate a professional PDF comparison report."""
    generator = ComparisonPdfGenerator()
    pdf_bytes = generator.generate(result, options)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "attachment; filename=code_comparison_report.pdf"
        },
    )
```

**PDF Contents:**
1. **Cover Page**: Study ID, Dataset, Date, Similarity Score
2. **Executive Summary**: Narrative + key metrics
3. **Comparison Details**:
   - Side-by-side code snippets (first 50 lines)
   - Highlighted differences table
4. **ADaM Insights** (if Deep mode)
5. **Recommendations**

### 9.2 HTML Snapshot

**Self-contained HTML export:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Code Comparison: ADSL - Developer vs QC</title>
  <style>/* Embedded styles */</style>
</head>
<body>
  <!-- Full comparison UI, read-only -->
  <div class="comparison-snapshot">
    <!-- Similarity scores -->
    <!-- Diff visualization -->
    <!-- Difference list -->
  </div>
  <script>/* Embedded interactive diff viewer */</script>
</body>
</html>
```

**Use Case**: Email to stakeholders, attach to submission package

### 9.3 Shareable Links (Future)

**Backend:**
- Store comparison result in database with unique ID
- Generate short URL: `https://adam-ai.com/compare/abc123`
- Expire after 7 days

**Frontend:**
```typescript
const handleShare = async () => {
  const shareId = await api.shareComparison(result);
  const shareUrl = `${window.location.origin}/compare/${shareId}`;

  navigator.clipboard.writeText(shareUrl);
  message.success('Shareable link copied!');
};
```

---

## 10. Testing & Validation Strategy

### 10.1 Backend Testing

**Unit Tests (`test_code_comparer_service.py`):**
```python
def test_identical_code_comparison():
    """Identical code should yield 100% similarity."""
    code = "x <- 1\ny <- 2"
    result = service.compare(code, code, mode="quick")
    assert result.overall_similarity_score == 100
    assert result.differences == []

def test_functional_difference_detected():
    """Critical functional difference should be flagged."""
    code1 = "if x > 0: y = 1"
    code2 = "if x < 0: y = 1"  # Reversed condition!

    result = service.compare(code1, code2, mode="standard")
    assert result.summary.critical_count >= 1
    assert any(d.type == "functional" for d in result.differences)

def test_ai_timeout_graceful_degradation():
    """Should return basic diff if AI times out."""
    with patch('llm_service.generate', side_effect=TimeoutError):
        result = service.compare(code1, code2, mode="standard")
        assert result is not None  # Partial success
        assert result.metadata.llm_used == False
```

**Integration Tests:**
```python
@pytest.mark.asyncio
async def test_full_comparison_pipeline():
    """Test entire pipeline with real LLM call."""
    code1 = load_sample_r_code("developer_adsl.R")
    code2 = load_sample_r_code("qc_adsl.R")

    result = await service.compare(
        code1, code2,
        mode="deep",
        context={"study_id": "TEST001", "dataset": "ADSL"}
    )

    assert result.overall_similarity_score > 0
    assert len(result.differences) > 0
    assert result.adam_insights is not None
```

### 10.2 Frontend Testing

**Component Tests (`CodeComparerTab.test.tsx`):**
```typescript
test('disables Compare button when code is empty', () => {
  render(<CodeComparerTab />);
  const button = screen.getByText(/Compare/i);
  expect(button).toBeDisabled();
});

test('shows loading state during comparison', async () => {
  render(<CodeComparerTab />);
  // Fill editors and click Compare
  fireEvent.click(screen.getByText(/Compare/i));
  expect(screen.getByText(/Analyzing differences/i)).toBeInTheDocument();
});

test('renders differences after successful comparison', async () => {
  const mockResult = {
    overall_similarity_score: 85,
    summary: { total_differences: 3, critical_count: 1 },
    differences: [/* mock data */],
  };

  api.compareCode = jest.fn().mockResolvedValue(mockResult);

  render(<CodeComparerTab />);
  // Trigger comparison
  await waitFor(() => {
    expect(screen.getByText(/85% Similar/i)).toBeInTheDocument();
    expect(screen.getByText(/1 Critical/i)).toBeInTheDocument();
  });
});
```

**Accessibility Tests:**
```typescript
test('meets WCAG 2.1 AA standards', async () => {
  const { container } = render(<CodeComparerTab />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

test('keyboard navigation works', () => {
  render(<CodeComparerTab />);
  const nextButton = screen.getByLabelText(/Next difference/i);

  userEvent.keyboard('{Alt>}n{/Alt}');
  expect(nextButton).toHaveFocus();
});
```

### 10.3 User Acceptance Testing

**Validation Checklist:**
- [ ] New user can complete first comparison in <2 minutes
- [ ] All sample comparisons run without errors
- [ ] Similarity scores match manual review (±5%)
- [ ] Critical differences are correctly flagged (95% accuracy)
- [ ] Export PDF renders correctly
- [ ] Keyboard shortcuts work as documented
- [ ] Screen reader announces results clearly
- [ ] No console errors on any user action

**UAT Scenarios:**
1. **Scenario 1**: Compare two nearly identical R programs
   - Expected: >90% similarity, <3 minor differences, green summary
2. **Scenario 2**: Compare SAS with reversed logic
   - Expected: <70% similarity, ≥1 critical difference, red flag
3. **Scenario 3**: Deep analysis with ADaM context
   - Expected: ADaM insights populated, CDISC rules referenced
4. **Scenario 4**: Large file (1500 lines)
   - Expected: Comparison completes in <10s, no UI freeze
5. **Scenario 5**: LLM unavailable (simulated)
   - Expected: Basic diff still works, warning shown

---

## 11. Edge Cases & Error Handling

### 11.1 Edge Cases

| Edge Case | Handling Strategy |
|-----------|-------------------|
| Both codes empty | Disable Compare button, show hint |
| Codes are identical | Show "100% identical" banner, offer to cancel |
| One code is empty | Allow comparison, show "Added" or "Removed" diff |
| Code exceeds 50k chars | Reject with error: "File too large. Limit: 2000 lines" |
| Invalid language selection | Auto-detect or treat as plain text |
| Mixed languages (SAS vs R) | Allow, but disable functional equivalence check |
| Code with syntax errors | Show diff + syntax errors panel, proceed anyway |
| LLM timeout | Show basic diff + warning banner |
| LLM returns invalid JSON | Fall back to heuristics, log error |
| Network failure during comparison | Show retry button, preserve input state |
| User navigates away mid-comparison | Cancel request, clean up state |

### 11.2 Error Messages (User-Friendly)

**Example Error Messages:**
```typescript
const ERROR_MESSAGES = {
  CODE_TOO_LARGE: "The code you're trying to compare is too large (over 2000 lines). Please split into smaller sections.",

  NETWORK_ERROR: "Unable to connect to the comparison service. Please check your connection and try again.",

  LLM_TIMEOUT: "AI analysis is taking longer than expected. We've shown you the basic differences. Try Quick mode for faster results.",

  INVALID_SYNTAX: "Code 1 has syntax errors on lines 42, 89. Comparison will proceed, but results may be affected.",

  UNKNOWN_ERROR: "Something went wrong. Our team has been notified. Please try again or contact support.",
};
```

**Error UI:**
```tsx
<Alert
  type="error"
  message="Comparison Failed"
  description={errorMessage}
  action={
    <Space>
      <Button size="small" onClick={handleRetry}>Retry</Button>
      <Button size="small" type="link" onClick={handleContactSupport}>
        Contact Support
      </Button>
    </Space>
  }
  closable
/>
```

---

## 12. Rollout Plan

### Phase 1: Development (Weeks 1-2)
- [ ] Backend service implementation
- [ ] Frontend component structure
- [ ] Monaco DiffEditor integration
- [ ] Basic diff + Quick mode working
- [ ] Unit tests

### Phase 2: AI Integration (Week 3)
- [ ] LLM-powered categorization
- [ ] Standard mode implementation
- [ ] Prompt engineering & testing
- [ ] Error handling & fallbacks

### Phase 3: Advanced Features (Week 4)
- [ ] Deep Analysis mode
- [ ] ADaM domain analyzer
- [ ] Export PDF/HTML
- [ ] Sample programs
- [ ] Accessibility audit

### Phase 4: Testing & Refinement (Week 5)
- [ ] Integration testing
- [ ] UAT with ADaM programmers
- [ ] Performance optimization
- [ ] Bug fixes

### Phase 5: Production Release (Week 6)
- [ ] Feature flag enabled
- [ ] Documentation updated
- [ ] User training materials
- [ ] Monitor metrics

---

## 13. Observability & Metrics

### 13.1 Backend Metrics

**Track via logging:**
```python
logger.info("code_comparison_completed", extra={
    "comparison_mode": request.comparison_mode,
    "similarity_score": result.overall_similarity_score,
    "critical_differences": result.summary.critical_count,
    "execution_time_ms": result.metadata.execution_time_ms,
    "llm_used": result.metadata.llm_used,
    "code_size_chars": len(request.code_1) + len(request.code_2),
})
```

**Dashboards:**
- Average comparison time (by mode)
- Similarity score distribution
- LLM usage rate
- Error rate (by error type)

### 13.2 Frontend Analytics

**Track user actions:**
- Comparison initiated (by mode)
- Sample loaded
- Difference clicked
- Export generated
- Error occurred

---

## 14. Open Questions & Decisions Required

### 14.1 Critical Decisions

**Q1: Should we support cross-language comparison (SAS vs R) in MVP?**
- **Recommendation**: YES, but with limitations
  - Allow comparison for structural similarity
  - Disable functional equivalence checks
  - Show warning: "Cross-language comparison has limited accuracy"
  - Useful for QC teams that use different languages

**Q2: Should we persist comparison history?**
- **Recommendation**: NOT in MVP, add in Phase 2
  - MVP: Session-based only
  - Phase 2: Add history table, 30-day retention
  - Phase 3: Tie to study/dataset for audit trail

**Q3: Maximum file size limit?**
- **Recommendation**: 50,000 characters (~2000 lines)
  - Covers 95% of ADaM programs
  - For larger: Suggest comparing in sections
  - Future: Support chunked comparison

**Q4: Which LLM provider for categorization?**
- **Recommendation**: GPT-4o-mini (default), with fallback
  - Fast (2-3s response time)
  - Accurate for code understanding
  - Fallback order: Gemini Flash → Claude Haiku → Heuristics

**Q5: Should we validate code execution equivalence?**
- **Recommendation**: NOT in MVP (too complex)
  - Static analysis only
  - Suggest using ADAM Generator for execution testing
  - Phase 3 feature: "Test equivalence" button

### 14.2 Clarifications Needed from Product Owner

1. **Regulatory requirements**: Do comparison reports need to be 21 CFR Part 11 compliant (audit trail, e-signatures)?
2. **Export format preferences**: PDF sufficient, or also need Word/Excel?
3. **User access control**: Should Code Comparer require special permissions?
4. **SLA expectations**: What's acceptable response time for Deep mode (15s? 30s?)?
5. **Branding**: Any specific visual style for comparison reports (logo, colors)?

---

## 15. Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Monaco DiffEditor performance issues with large files | Medium | High | Implement virtualization, file size limits, progressive rendering |
| LLM categorization inaccurate | Low | Medium | Validate with test suite, allow manual override in Phase 2 |
| Users confused by severity labels | Medium | Medium | Clear definitions in UI, examples in samples |
| Backend timeout on slow networks | Low | High | Implement client-side retry, increase timeouts, show progress |
| Accessibility compliance gaps | Low | High | Conduct audit early, use ARIA best practices |
| Scope creep (too many features) | High | Medium | Strict adherence to MVP scope, defer advanced features |

---

## 16. Success Metrics (3 Months Post-Launch)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Adoption** | 60% of active users try Code Comparer | Backend analytics |
| **Usage frequency** | 3+ comparisons/week per QC team | Backend analytics |
| **Satisfaction** | 4.5/5 user rating | In-app survey |
| **Accuracy** | 90% agreement with manual review | UAT validation |
| **Performance** | 95% of comparisons <5s | Backend metrics |
| **Error rate** | <2% of comparisons fail | Backend error logs |

---

## 17. Documentation & Training

### 17.1 User Documentation

**User Guide Sections:**
1. Getting Started (2 min tutorial)
2. Understanding Similarity Scores
3. Interpreting Difference Categories
4. Best Practices for Code Comparison
5. Keyboard Shortcuts Reference
6. Troubleshooting Common Issues

**Video Tutorials:**
- "Your First Comparison" (3 min)
- "Deep Analysis for Regulatory Review" (5 min)
- "Exporting Comparison Reports" (2 min)

### 17.2 Developer Documentation

- API Reference (OpenAPI/Swagger)
- Architecture Decision Records (ADRs)
- Contributing Guide
- Prompt Engineering Guide (for LLM categorization)

---

## 18. Future Enhancements (Post-MVP)

**Phase 2 (6 months):**
- Comparison history and search
- Manual difference categorization override
- Multi-file comparison (compare entire programs folder)
- Integration with version control (Git diff UI)

**Phase 3 (12 months):**
- Three-way merge visualization
- Automated QC acceptance workflow
- Real-time collaborative comparison
- AI-suggested code merge

---

## Appendix A: Technical Dependencies

### Frontend
- `@monaco-editor/react`: ^4.7.0
- `antd`: ^5.x
- `react-window`: For virtualization
- `jspdf`: For PDF export
- `html2canvas`: For HTML export

### Backend
- `difflib`: Built-in Python
- `asyncio`: Built-in Python
- `reportlab` or `weasyprint`: PDF generation
- Existing LLM integration modules

---

## Appendix B: Research Sources

This plan incorporates industry best practices from:

1. **Code Comparison Tools Research**:
   - [What is Diff - Understanding Code Diff Tools | Codecademy](https://www.codecademy.com/article/what-is-diffing)
   - [Pros and Cons of Code Compare 2024](https://www.trustradius.com/products/code-compare/reviews?qs=pros-and-cons)

2. **UI/UX Best Practices**:
   - [How to design feature comparison tables | LogRocket](https://blog.logrocket.com/ux-design/ui-design-comparison-features/)
   - [4 Ways to Optimize the Comparison Feature – Baymard](https://baymard.com/blog/user-friendly-comparison-tools)
   - [10 UX Trends That Will Shape the Industry in 2024](https://www.wix.com/blog/ux-design-trends)

3. **Monaco Editor Integration**:
   - [monaco-editor/react - npm](https://www.npmjs.com/package/@monaco-editor/react)
   - [DiffEditor Component | DeepWiki](https://deepwiki.com/suren-atoyan/monaco-react/2.2-diffeditor-component)
   - [Monaco Editor React Docs](https://monaco-react.surenatoyan.com/)

---

## Summary of Improvements Over Initial Plan

✅ **Added**: Progressive disclosure UX to avoid overwhelming users
✅ **Added**: Three comparison modes (Quick, Standard, Deep)
✅ **Added**: Export capabilities (PDF, HTML, JSON)
✅ **Added**: Comprehensive keyboard navigation and accessibility
✅ **Added**: Performance optimizations for large files
✅ **Added**: Graceful error handling and partial results
✅ **Added**: Sample programs with guided learning flow
✅ **Enhanced**: Difference categorization with ADaM domain mapping
✅ **Enhanced**: Visual diff with Monaco DiffEditor best practices
✅ **Enhanced**: User flows with time estimates
✅ **Clarified**: Technical implementation details for both frontend and backend
✅ **Structured**: Clear rollout plan, testing strategy, and success metrics

This revised plan provides a **production-ready roadmap** for building an industry-grade Code Comparer that sets a new standard for code comparison in clinical trial programming.



























