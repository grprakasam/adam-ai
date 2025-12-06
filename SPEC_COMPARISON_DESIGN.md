# Spec Comparison Module - Design Specification

## Overview

The **Spec Comparison** module is a powerful, decision-oriented tool for comparing two ADAM specification files. It provides comprehensive semantic analysis, actionable insights, and AI-powered Q&A to help clinical programmers understand and act on specification changes.

## Architecture

### Frontend Components

```
frontend/src/components/
├── SpecComparisonTab.tsx      # Main component (1,260+ lines)
└── SpecComparisonTab.css      # Premium styling (700+ lines)
```

### Backend API

```
backend/app/api/v1/endpoints/
└── spec_comparison.py         # API endpoints (500+ lines)
```

## Feature Breakdown

### 1. File Upload Section

**Design Philosophy**: Side-by-side comparison with visual clarity

- **Specification A** (Purple theme): Upload first/older version
- **Specification B** (Orange theme): Upload second/newer version
- **Visual VS separator**: Clear distinction between files
- **File metadata display**: Variable count, sheet names, file info

**User Experience**:
- Drag & drop or click to upload
- Supports `.xlsx` and `.xls` formats
- Instant file parsing with metadata preview
- One-click file removal

### 2. Comparison Analysis Engine

**Capabilities**:
- **Added Variables**: New variables in Spec B not in Spec A
- **Removed Variables**: Variables in Spec A deleted from Spec B
- **Modified Variables**: Variables with changed attributes

**Analyzed Fields**:
| Field | Impact Level |
|-------|-------------|
| derivation | High |
| type | High |
| codeList | High |
| length | Medium |
| format | Medium |
| source | Medium |
| label | Low |
| core | Low |

### 3. Results Dashboard

#### Summary Cards
- **Overall Match %**: Percentage of unchanged variables
- **Variables Added**: Count with impact assessment
- **Variables Removed**: Count with impact assessment
- **Variables Modified**: Count with change details

#### Difference Panels
Side-by-side panels showing:
- Added variables with category and type tags
- Modified variables with field-level change details
- Visual impact scoring (color-coded)

### 4. Decision Recommendations

**Auto-generated actionable insights based on changes**:

| Priority | Trigger | Example |
|----------|---------|---------|
| High | Population flag changes (SAFFL, ITTFL) | "Review SAP and update population derivation" |
| High | Derivation logic changes | "Update affected programs and TLF logic" |
| Medium | New safety variables | "Add to ADAE derivation programs" |
| Medium | Variable removals | "Remove from programs and outputs" |
| Low | Label/format changes | "Minor updates needed" |

### 5. AI Suggestions Panel

**Capabilities**:
- Natural language Q&A about comparison results
- Context-aware responses based on detected changes
- Quick action buttons for common questions

**Quick Prompts**:
1. "Show critical changes"
2. "Explain AGEGR1 impact"
3. "Generate code snippets"
4. "What needs SAP update?"

**AI Response Features**:
- Markdown formatting support
- Code snippets with syntax highlighting
- Impact assessments
- Implementation recommendations

## API Endpoints

### `POST /api/v1/spec-comparison/upload`
Upload and parse a single specification file.

**Request**: `multipart/form-data` with Excel file
**Response**:
```json
{
  "status": "success",
  "metadata": {
    "filename": "ADSLSpec_v2.xlsx",
    "sheets": ["Variables", "ValueLevel"],
    "totalVariables": 52,
    "uploadedAt": "2024-12-06T16:30:00Z"
  }
}
```

### `POST /api/v1/spec-comparison/compare`
Compare two specification files.

**Request**: `multipart/form-data` with two Excel files
**Response**:
```json
{
  "totalVariablesA": 52,
  "totalVariablesB": 55,
  "commonVariables": 51,
  "addedVariables": [...],
  "removedVariables": [...],
  "modifiedVariables": [...],
  "matchPercentage": 85.2,
  "criticalChanges": 2,
  "recommendations": [...]
}
```

### `POST /api/v1/spec-comparison/ai-query`
Get AI-powered analysis of comparison.

**Request**:
```json
{
  "message": "What are the critical changes?",
  "context": "Comparison summary..."
}
```
**Response**:
```json
{
  "response": "Based on the analysis...",
  "suggestedQuestions": [...]
}
```

## UI/UX Design Patterns

### Color Scheme
| Element | Color | Hex |
|---------|-------|-----|
| Primary (Compare button) | Indigo | #4f46e5 |
| Success (Added) | Green | #10b981 |
| Error (Removed) | Red | #ef4444 |
| Warning (Modified) | Amber | #f59e0b |
| AI Theme | Purple | #7c3aed |

### Animations
- **fadeInUp**: Results section entrance
- **pulse-glow**: Compare button during processing
- **spin**: Loading spinner

### Responsive Breakpoints
- **1200px**: 4-column → 2-column summary grid
- **768px**: Single column layout

## Integration Points

### With Other Modules
- **Pair Programming**: Reference specification changes
- **Code Generation**: Update templates based on changes
- **Traceability**: Track specification version lineage

### Data Flow
```
User Upload → Parse Excel → Extract Variables → Compare → 
Generate Differences → Calculate Impact → Create Recommendations → 
Display Results → Enable AI Q&A
```

## Technical Highlights

1. **Intelligent Variable Categorization**
   - Demographics, Safety, Treatment, Population, etc.
   - Pattern-based classification

2. **Impact Scoring Algorithm**
   - Weighted by field importance
   - Context-aware (population flags = higher impact)

3. **Recommendation Engine**
   - Rule-based generation
   - Prioritized by regulatory impact

4. **AI Integration**
   - Fallback mock responses for demo
   - Ready for LLM service integration

## Future Enhancements

1. **Version History**: Track all spec versions over time
2. **PDF Export**: Formatted comparison reports
3. **Batch Compare**: Multiple spec files at once
4. **Change Tracking**: Git-like diff visualization
5. **Collaboration**: Team annotations and approvals

## Usage Instructions

1. Navigate to **Specifications.AI → Spec Comparison**
2. Upload **Specification A** (base/older version)
3. Upload **Specification B** (new/updated version)
4. Click **Compare Specifications**
5. Review the **Summary** tab for overview
6. Check **All Changes** tab for detailed table
7. Use **AI Suggestions** tab for deeper analysis

---

*Module designed and implemented for ADAM AI - Clinical Programming Intelligence Platform*
