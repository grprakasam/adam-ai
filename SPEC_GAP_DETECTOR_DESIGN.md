# Spec Gap Detector - Design Specification

## Overview

The **Spec Gap Detector** (also known as Missing Spec Detector) is an innovative, SaaS-quality validation tool that compares ADAM datasets against their specifications. It automatically identifies discrepancies, missing values, and specification violations that could cause issues during regulatory submission.

## Unique Selling Points (USPs)

1. **Visual Health Score Ring** - Animated SVG visualization showing compliance at a glance
2. **Dark Premium Theme** - Professional SaaS aesthetic with gradient animations
3. **AI Resolution Assistant** - Interactive chat for fix recommendations
4. **Categorized Issue Tracking** - Critical, Warning, and Info panels
5. **Submission Readiness Assessment** - Clear go/no-go guidance

## Architecture

### Frontend Components

```
frontend/src/components/
├── MissingSpecDetectorTab.tsx    # Main component (1,100+ lines)
└── MissingSpecDetectorTab.css    # Premium styling (900+ lines)
```

### Backend API

```
backend/app/api/v1/endpoints/
└── spec_gap_detector.py          # API endpoints (500+ lines)
```

## Feature Breakdown

### 1. Hero Section

**Design Elements:**
- Animated rotating conic gradient background
- Glowing icon with pulse animation
- Dynamic statistics showing analysis results
- Premium glassmorphism effect

### 2. File Upload Section

**Dual Upload Cards:**
- **Dataset Card (Cyan)**: Accepts SAS7BDAT, XPT, CSV, RDS
- **Specification Card (Purple)**: Accepts XLSX, XLS
- **Connector**: Visual link showing relationship

**File Preview:**
- File name and status
- Quick stats (records, variables)
- One-click removal

### 3. Health Score Visualization

**Animated Ring:**
- SVG-based circular progress
- Gradient colors based on status:
  - Excellent (90-100%): Green gradient
  - Good (70-89%): Blue gradient
  - Warning (50-69%): Amber gradient
  - Critical (0-49%): Red gradient

**Metrics Grid:**
- Critical issues count
- Warning count
- Info count
- Matching variables count

### 4. Issue Categories

**Three-Panel Grid:**

| Panel | Color | Purpose |
|-------|-------|---------|
| Critical | Red | Blocking issues for submission |
| Warnings | Amber | Should fix before submission |
| Info | Blue | Nice-to-have improvements |

**Issue Item Display:**
- Variable name (monospace)
- Issue description
- Affected record count
- Hover animation

### 5. AI Resolution Assistant

**Capabilities:**
- Variable-specific analysis
- Code snippet generation
- Submission readiness assessment
- Priority-based resolution planning

**Quick Prompts:**
1. "Explain SAFFL issue"
2. "How to fix missing values?"
3. "Is this submission ready?"
4. "Show resolution plan"

**Chat Interface:**
- Markdown rendering
- Code syntax highlighting
- User/Assistant message styling
- Loading state indicator

### 6. Detailed Issues Table

**Features:**
- Sortable columns
- Filterable by severity
- Searchable
- Export capabilities

**Columns:**
| Column | Description |
|--------|-------------|
| Variable | Variable name (code format) |
| Severity | Critical/Warning/Info tag |
| Category | Issue category tag |
| Issue | Brief description |
| Affected | Record count |
| Recommendation | Fix suggestion |

## API Endpoints

### `POST /api/v1/spec-gap-detector/upload-dataset`
Upload and parse a dataset file.

**Request**: `multipart/form-data` with dataset file
**Response**:
```json
{
  "status": "success",
  "metadata": {
    "filename": "ADSL.sas7bdat",
    "observations": 350,
    "variables": 52,
    "domain": "ADSL"
  }
}
```

### `POST /api/v1/spec-gap-detector/upload-spec`
Upload and parse a specification file.

### `POST /api/v1/spec-gap-detector/validate`
Compare dataset against specification.

**Response**:
```json
{
  "healthScore": 64,
  "healthStatus": "warning",
  "totalVariablesChecked": 52,
  "issues": [...],
  "criticalCount": 3,
  "warningCount": 3,
  "infoCount": 2,
  "recommendations": [...]
}
```

### `POST /api/v1/spec-gap-detector/ai-query`
Get AI-powered analysis.

## Issue Categories

| Category | Severity | Description |
|----------|----------|-------------|
| Missing Variable | Critical | Required variable not in dataset |
| Missing Values | Varies | Required field has nulls |
| Value Out of Range | Critical | Values exceed spec limits |
| Codelist Mismatch | Warning | Value not in controlled terminology |
| Format Mismatch | Warning | Length/format differs from spec |
| Extra Variable | Info | Dataset has variable not in spec |
| Label Mismatch | Info | Label text differs |
| Type Mismatch | Critical | Data type doesn't match |

## Design System

### Color Palette (Dark Theme)

| Color | Hex | Usage |
|-------|-----|-------|
| Background | #0f172a | Main container |
| Surface | #1e293b | Cards, panels |
| Cyan | #38bdf8 | Dataset theme, info |
| Purple | #a855f7 | Spec theme, AI |
| Green | #22c55e | Success, matching |
| Amber | #f59e0b | Warnings |
| Red | #ef4444 | Critical, errors |
| Text Primary | #f8fafc | Headlines |
| Text Secondary | #94a3b8 | Body text |
| Text Muted | #64748b | Labels |

### Animations

| Animation | Duration | Usage |
|-----------|----------|-------|
| rotateGradient | 20s | Hero background |
| pulseGlow | 3s | Hero icon |
| slideUpFade | 0.6s | Results entrance |
| spinGradient | 1.5s | Loading spinner |
| progressSlide | 2s | Progress bar |
| messageSlide | 0.3s | Chat messages |

### Breakpoints

| Breakpoint | Layout Changes |
|------------|----------------|
| 1200px | Issues grid → single column |
| 768px | Upload cards → stacked |

## Integration Points

### With Other Modules:
- **Pair Programming**: Flag variables with issues
- **Traceability**: Link issues to source data
- **Submission Dashboard**: Report validation status

### Data Flow:
```
User Upload → Parse Files → Compare Variables → 
Calculate Issues → Score Health → Generate Recommendations → 
Display Results → Enable AI Q&A
```

## Mock Issues (Demo Mode)

The system generates realistic mock issues for demonstration:

1. **SAFFL Missing** (Critical)
   - Safety Population Flag required but absent

2. **TRTSDT Missing Values** (Critical)
   - Treatment Start Date has 5% missing

3. **AGE Out of Range** (Critical)
   - Values outside 18-85 range

4. **AGEGR1 Codelist** (Warning)
   - Category values don't match spec

5. **RACE Length** (Warning)
   - Variable length exceeds specification

6. **SITEID Missing** (Warning)
   - Optional field with missing values

7. **RFSTDTC Extra** (Info)
   - Variable in dataset but not spec

8. **STUDYID Label** (Info)
   - Label text differs from spec

## Usage Instructions

1. Navigate to **Specifications.AI → Spec Gap Detector**
2. Upload your **ADAM Dataset** (left card)
3. Upload corresponding **Specification** (right card)
4. Click **Detect Gaps**
5. Review **Health Score** and status
6. Check **Issue Categories** by severity
7. Use **AI Assistant** for fix recommendations
8. View **All Issues** table for details
9. **Export Report** when ready

## Future Enhancements

1. **Batch Validation** - Multiple datasets at once
2. **Auto-Fix Suggestions** - One-click code generation
3. **Historical Tracking** - Compare across versions
4. **Team Collaboration** - Assign issues to team members
5. **Integration with Define-XML** - Auto-generate documentation
6. **Statistical Analysis** - Summary of missing value patterns
7. **PDF/Word Reports** - Formatted validation reports

---

*Module designed for ADAM AI - Clinical Programming Intelligence Platform*
*Unique selling point for competitive differentiation in clinical programming tools market*
