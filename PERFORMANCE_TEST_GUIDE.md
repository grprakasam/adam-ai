# Performance Test Guide - Code Generation with Specification

## Overview
This guide explains how to test code generation performance using your actual specification files and get detailed metrics for each variable.

## Prerequisites

1. **Backend server must be running**
   ```bash
   cd backend
   python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

2. **Install required dependencies** (if not already installed)
   ```bash
   cd backend
   pip install pandas openpyxl requests
   ```

## Running the Performance Test

### Option 1: Using the Direct Test Script (Recommended)

```bash
cd backend
python3 scripts/test_spec_performance.py
```

This script will:
1. Find your specification files in `Content/UserInputs/ADAMSpecifications/`
2. Load the specification (e.g., `ADSLSpec.xlsx`)
3. Generate code for all variables
4. Show detailed metrics per variable
5. Save results to `performance_results.json`

### Option 2: Using the API Endpoint

You can also test via the API:

```bash
# First, categorize the specification
curl -X POST "http://localhost:8000/api/v1/specification/categorize-by-path" \
  -H "Content-Type: application/json" \
  -d '{
    "spec_file_path": "Content/UserInputs/ADAMSpecifications/ADSLSpec.xlsx",
    "dataset_type": "ADSL"
  }'

# Then generate code using the categorized result
curl -X POST "http://localhost:8000/api/v1/code-generation/generate-code-bulk" \
  -H "Content-Type: application/json" \
  -d '{
    "study_id": "TEST001",
    "dataset": "ADSL",
    "language": "R",
    "categorized_variables": { ... },
    "standards": {
      "sdtm_version": "1.7",
      "adam_ig_version": "1.3"
    }
  }'
```

## Expected Output

The test will show:

### Overall Summary
```
📊 OVERALL SUMMARY
Total Variables:        50
Total Time:              45.23 seconds (0.75 minutes)
Generation Time:        42.10 seconds
Variables/Second:       1.11
Average Time/Variable:   0.90 seconds
```

### Generation Method Breakdown
```
📈 GENERATION METHOD BREAKDOWN
Template-Based:           15 ( 30.0%)
LLM-Generated:           30 ( 60.0%)
Cached:                    5 ( 10.0%)
Errors:                    0 (  0.0%)
```

### Per-Variable Details
```
📋 PER-VARIABLE DETAILS
#    Variable            Method          Status     Code Length
----------------------------------------------------------------
1    AGE                 Template        ✅ OK      45
2    SEX                 Template        ✅ OK      38
3    RACE                LLM (groq)      ✅ OK      120
4    AGEGR1              LLM (groq)      ✅ OK      156
...
```

## Performance Targets

Based on the optimizations implemented:

| Variables | Target Time | Status |
|-----------|-------------|--------|
| 20 vars   | <30 seconds | ✅ Excellent |
| 50 vars   | <60 seconds | ✅ Excellent |
| 100 vars  | <120 seconds | ✅ Excellent |

## Understanding the Metrics

### Template-Based Generation
- **What**: Variables with simple patterns (direct mappings, flags, etc.)
- **Time**: Instant (0 seconds)
- **Impact**: 30-50% of variables typically use templates

### LLM-Generated
- **What**: Variables requiring AI code generation
- **Time**: ~1-2 seconds per variable (with batching)
- **Impact**: 50-70% of variables use LLM

### Cached
- **What**: Previously generated variables
- **Time**: Instant (0 seconds)
- **Impact**: Improves with repeated runs

## Troubleshooting

### Issue: ModuleNotFoundError
**Solution**: Install dependencies
```bash
cd backend
pip install -r requirements.txt
```

### Issue: Specification file not found
**Solution**: Check file path
```bash
ls -la Content/UserInputs/ADAMSpecifications/
```

### Issue: API timeout
**Solution**: Increase timeout in test script or check server logs

## Next Steps

After running the test:

1. **Review the metrics** - Check if performance meets targets
2. **Analyze template coverage** - See how many variables use templates
3. **Check for errors** - Review any failed generations
4. **Compare with previous runs** - Track performance improvements

## Files Generated

- `backend/performance_results.json` - Detailed results in JSON format
- Console output - Real-time progress and summary

## Notes

- First run may be slower due to no cache
- Subsequent runs will be faster due to caching
- Template generation is instant (no API calls)
- LLM generation uses batching (25 variables per API call)
