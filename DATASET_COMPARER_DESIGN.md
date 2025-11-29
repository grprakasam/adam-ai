# Dataset Comparer - Technical Design & Architecture

## Executive Summary

The Dataset Comparer is a professional, domain-centric tool designed specifically for ADAM developers to compare Developer vs QC datasets. It provides comprehensive validation across metadata, structure, observations, and values with three comparison modes optimized for different use cases.

---

## Design Philosophy

**"QC-First, Results-Driven"**

The primary use case is **comparing Developer vs QC datasets** for regulatory validation. The UI and workflow are optimized for this specific need while maintaining flexibility for other comparison scenarios.

### Core Principles

1. **Progressive Disclosure**: Show simple options first, advanced settings hidden by default
2. **Clear Visual Feedback**: Immediate, actionable insights with visual hierarchy
3. **Domain-Centric**: Tailored for ADAM developers with clinical trials terminology
4. **Performance-Aware**: Three modes balancing speed vs depth
5. **Regulatory-Ready**: Export capabilities for documentation and audit trails

---

## Feature Categorization Framework

### TIER 1: Dataset Validation (Quick Check - <1s)
**Purpose**: Fast preliminary check

- **Dataset Metadata**
  - Creation dates
  - Modification dates
  - Number of variables (NVar)
  - Number of observations (NObs)
  - Dataset labels

- **Structure**
  - Variable count match
  - Variable names match
  - Variables in common
  - Variables unique to each dataset

### TIER 2: Content Validation (Standard QC - 2-5s)
**Purpose**: Routine QC workflow (recommended)

Includes all of TIER 1, plus:

- **Variable Attributes**
  - Variable types (character vs. numeric)
  - Type mismatches
  - Variable properties

- **Observation Matching**
  - Total observations in each dataset
  - Observations in common (by key variable)
  - Observations with equal values
  - Observations with unequal values
  - Unique observations

- **Value Comparison**
  - Exact value matching for selected variables
  - Missing value handling (customizable)
  - Character comparison (case-sensitive/insensitive)
  - Whitespace handling

### TIER 3: Statistical Validation (Comprehensive - 10-30s)
**Purpose**: Full regulatory validation

Includes all of TIER 1 & 2, plus:

- **Statistical Analysis**
  - Mean, std dev for numeric variables
  - Maximum difference
  - Tolerance-based comparison (epsilon)
  - Relative difference analysis
  - Distribution comparison

- **Detailed Reporting**
  - Variable-by-variable breakdown
  - Observation-level differences
  - Export-ready documentation

---

## User Interface Design

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Dataset Comparer Header                                     │
│ [Sample Datasets] [Help]                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐        VS        ┌──────────────────┐│
│  │ Developer Dataset│                  │ QC Dataset       ││
│  │ [Upload/Browse]  │                  │ [Upload/Browse]  ││
│  │                  │                  │                  ││
│  │ ADSL.sas7bdat    │                  │ ADSL_QC.sas7bdat ││
│  │ ✓ 450 obs        │                  │ ✓ 450 obs        ││
│  │   52 vars        │                  │   52 vars        ││
│  └──────────────────┘                  └──────────────────┘│
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ Comparison Settings                                         │
│                                                              │
│  Comparison Mode:                                           │
│  ○ Quick Check (Metadata & structure only, <1s)            │
│  ● Standard QC (Recommended for routine QC, 2-5s)          │
│  ○ Comprehensive (Full validation with stats, 10s+)        │
│                                                              │
│  [⚙️ Advanced Options ▼]                                    │
│                                                              │
│              [Compare Datasets]                             │
└─────────────────────────────────────────────────────────────┘
```

### Advanced Options (Collapsed by Default)

**Variable Selection**
- Compare all variables (default)
- Compare selected variables only
- Exclude metadata variables (timestamps, dates)

**Numeric Comparison**
- Exact match (default)
- Tolerance-based (specify epsilon: 1e-8)
- Relative difference (specify threshold: 0.01%)

**Missing Value Handling**
- Treat missing as different (default)
- Treat missing as equal
- Ignore observations with missing

**Character Comparison**
- Case-sensitive (default: Yes)
- Trim whitespace (default: Yes)

**Observation Matching**
- Key Variable: USUBJID (dropdown: USUBJID, SUBJID, STUDYID)

---

## Results Presentation

### Summary Dashboard
Visual overview with key metrics:

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 Overall Match: 98.5%  ●●●●●●●●●○                        │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │  ✓ Dataset Metadata    : Match                         │ │
│ │  ✓ Structure           : Match (52 common variables)   │ │
│ │  ⚠ Observations        : 448/450 match (2 differences) │ │
│ │  ⚠ Values              : 50/52 variables match         │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Tabbed Results

**Tab 1: Summary**
- Overall match percentage with progress bar
- Four quadrants: Metadata, Structure, Observations, Values
- Executive summary with color-coded status

**Tab 2: Values** (Most Important for QC)
- List of variables with differences
- Expandable panels for each variable
- Table showing:
  - USUBJID (key)
  - Developer Value
  - QC Value
  - Difference (for numeric)
  - Actions (Flag, Note)

**Tab 3: Structure**
- Common variables count
- Variables unique to Developer
- Variables unique to QC
- Type mismatches (if any)

**Tab 4: Statistics** (Comprehensive mode only)
- Numeric variable summary table
- Mean (Developer vs QC)
- Max difference
- Standard deviation of differences

---

## Backend Architecture

### Module Structure

```
backend/app/modules/dataset_comparer/
├── __init__.py
├── schemas.py           # Pydantic models
├── service.py           # Core comparison logic
└── formats/             # Format-specific loaders
    ├── csv_loader.py
    ├── excel_loader.py
    ├── sas_loader.py
    ├── xpt_loader.py
    └── r_loader.py
```

### API Endpoints

**POST /api/v1/dataset-comparer/compare**
- Input: DatasetComparisonRequest
- Output: DatasetComparisonResult
- Performs full comparison based on mode

**POST /api/v1/dataset-comparer/upload**
- Input: File upload (multipart/form-data)
- Output: File path and metadata
- Validates format and saves to temp directory

**GET /api/v1/dataset-comparer/health**
- Health check endpoint
- Returns available modes and supported formats

### Supported Formats

| Format | Extension | Library | Notes |
|--------|-----------|---------|-------|
| CSV | .csv | pandas | Standard |
| Excel | .xlsx, .xls | pandas | Openpyxl/xlrd |
| SAS | .sas7bdat | pandas | read_sas |
| XPT | .xpt | pandas | read_sas(format='xport') |
| R | .rds | pyreadr | Requires pyreadr package |

---

## Comparison Algorithms

### Structure Comparison
```python
1. Get variable lists from both datasets
2. Compute: common_vars = set1 ∩ set2
3. Compute: unique_to_1 = set1 - set2
4. Compute: unique_to_2 = set2 - set1
5. For each common variable:
   - Compare data types
   - Flag type mismatches
```

### Observation Comparison
```python
1. If key_variable exists in both datasets:
   a. Match observations by key_variable
   b. For each matched pair:
      - Compare all variable values
      - Count equal vs different
2. Else:
   a. Simple row count comparison
```

### Value Comparison
```python
For each common variable (excluding key):
   1. Merge datasets on key_variable
   2. For each matched observation:
      a. If numeric:
         - Apply tolerance/relative comparison
      b. If character:
         - Apply case-sensitivity rules
         - Apply whitespace trimming
   3. Collect differences (limit to 100 per variable)
   4. Generate ValueDifference object
```

### Overall Match Calculation
```python
overall_match = (
    structure_score * 0.3 +
    observations_score * 0.3 +
    values_score * 0.4
)

where:
- structure_score = 100 if perfect match, 50 if partial
- observations_score = (equal_count / total_count) * 100
- values_score = (matching_vars / total_vars) * 100
```

---

## Performance Optimization

### Quick Mode (<1s)
- Only loads metadata and column names
- No value-level comparison
- Uses pandas .info() for fast stats

### Standard Mode (2-5s)
- Loads full datasets into memory
- Compares up to 100 differences per variable
- Uses vectorized pandas operations

### Comprehensive Mode (10-30s)
- Full dataset comparison
- Statistical calculations for all numeric variables
- Detailed reporting with no limits

### Memory Management
- Uses chunking for large datasets (>1M rows)
- Cleanup of temp files after comparison
- Streaming for file uploads

---

## Export Capabilities

### PDF Report
- Executive summary on page 1
- Detailed differences by variable
- Statistical tables (comprehensive mode)
- Audit trail (timestamps, user, settings)

### Excel Export
- Multiple sheets:
  - Summary
  - Structure Differences
  - Value Differences
  - Statistics (if applicable)
- Formatted for readability
- Filterable tables

### CSV Export
- Flat file with all differences
- One row per difference
- Includes metadata columns

---

## Error Handling

### User-Friendly Messages

| Error | User Message | Technical Detail |
|-------|-------------|------------------|
| File not found | "Dataset file not found. Please check the file path." | FileNotFoundError |
| Unsupported format | "Format not supported. Use CSV, Excel, SAS, XPT, or R." | ValueError |
| Missing key variable | "Key variable 'USUBJID' not found in dataset." | KeyError |
| Memory error | "Dataset too large. Try Quick mode or contact support." | MemoryError |
| Type mismatch | "Variable types differ: AGE is Numeric in Dev, Character in QC." | TypeError |

---

## Testing Strategy

### Unit Tests
- Format loaders (each format)
- Comparison algorithms
- Value equality logic
- Statistical calculations

### Integration Tests
- End-to-end comparison workflow
- API endpoint responses
- File upload/download

### Performance Tests
- Large datasets (1M+ rows)
- Many variables (1000+ columns)
- Timeout handling

### Validation Tests
- Regulatory compliance scenarios
- Edge cases (all equal, all different)
- Missing value handling

---

## Future Enhancements

### Phase 2
- **Parallel Processing**: Multi-threaded comparison for large datasets
- **Incremental Comparison**: Only compare changed observations
- **History Tracking**: Compare against previous QC results
- **Automated Flagging**: ML-based anomaly detection

### Phase 3
- **Integration with CDISC Validator**: Cross-check compliance rules
- **Visual Diff Viewer**: Side-by-side dataset viewer
- **Batch Comparison**: Compare multiple dataset pairs
- **API Rate Limiting**: Enterprise-grade controls

---

## Security Considerations

### Data Privacy
- Datasets stored temporarily only during comparison
- Automatic cleanup after completion
- No cloud storage of PHI/PII
- Option for local-only processing

### Access Control
- Role-based permissions (future)
- Audit logging of comparisons
- Secure file upload validation

### Compliance
- HIPAA-compliant data handling
- FDA 21 CFR Part 11 ready (with audit trail)
- GDPR considerations for EU data

---

## Deployment

### Dependencies
```bash
# Python packages
pandas>=2.0.0
numpy>=1.24.0
openpyxl>=3.1.0  # Excel
pyreadr>=0.4.0   # R files
fastapi>=0.100.0
pydantic>=2.0.0
```

### Configuration
```yaml
dataset_comparer:
  max_file_size: 500MB
  timeout_quick: 1s
  timeout_standard: 30s
  timeout_comprehensive: 120s
  temp_directory: /tmp/dataset_comparer
  cleanup_age: 1h
```

---

## Success Metrics

### User Adoption
- % of QC workflows using Dataset Comparer
- Average comparisons per week
- Time saved vs manual comparison

### Quality Metrics
- Accuracy of difference detection
- False positive/negative rates
- User satisfaction score

### Performance Metrics
- P50/P95/P99 response times
- Success rate
- Error rate by category

---

## Conclusion

The Dataset Comparer provides a comprehensive, intuitive solution for ADAM dataset validation. By categorizing features into three tiers and providing a clean, progressive disclosure UI, it serves both quick checks and detailed regulatory validation needs. The architecture is extensible, performant, and designed with clinical trials domain expertise at its core.

**Design Status**: ✅ Complete & Production-Ready

**Last Updated**: 2025-11-29
**Author**: Claude Code (Technical Architect)
