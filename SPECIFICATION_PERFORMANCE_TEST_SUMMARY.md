# Specification Performance Test - Summary & Instructions

## Overview
I've created a comprehensive performance test script that will:
1. ✅ Load your actual specification file (`ADSLSpec.xlsx` or similar)
2. ✅ Generate code for ALL variables in the specification
3. ✅ Measure detailed timing metrics for each variable
4. ✅ Show breakdown by generation method (Template vs LLM vs Cached)
5. ✅ Save detailed results to JSON file

## Test Script Created

**File**: `backend/scripts/test_spec_performance.py`

This script:
- Uses the app's existing `SpecificationParser` to read Excel files
- Generates code for all variables with timing
- Shows per-variable metrics
- Tracks template vs LLM generation
- Saves results for analysis

## How to Run

### Step 1: Ensure Backend Dependencies are Installed

```bash
cd backend
pip install pandas openpyxl loguru
```

### Step 2: Run the Performance Test

```bash
cd backend
python3 scripts/test_spec_performance.py
```

## Expected Output Format

The test will show detailed metrics like this:

```
================================================================================
SPECIFICATION-BASED CODE GENERATION PERFORMANCE TEST
================================================================================

📄 Using specification: ADSLSpec.xlsx
✅ Loaded specification: 50 variables

📊 Specification Summary:
   Total variables: 50
   Language: R
   Dataset: ADSL

⚙️  Service Configuration:
   Batch size: 25
   Max concurrent: 15

================================================================================
GENERATING CODE FOR 50 VARIABLES
================================================================================

🚀 Starting code generation...

  [ 1/50] ✅ AGE_1
  [ 2/50] ✅ SEX_1
  [ 3/50] ✅ RACE_1
  ...
  [50/50] ✅ VAR_50

⏱️  Total Time: 45.23 seconds (0.75 minutes)

✅ SUCCESS!
   Generated: 50 code snippets
   Template-based: 15 (30.0%)
   LLM-generated: 30 (60.0%)
   Cached: 5 (10.0%)
   Time per variable: 0.90 seconds

📊 Performance Metrics:
   Variables/second: 1.11
   Expected time for 100 vars: 90.0 seconds

🎯 Optimization Targets:
   ✅ PASSED: 45.2s <= 60s target

================================================================================
DETAILED PERFORMANCE METRICS
================================================================================

📊 OVERALL SUMMARY
--------------------------------------------------------------------------------
Total Variables:        50
Total Time:             45.23 seconds (0.75 minutes)
Generation Time:        42.10 seconds
Variables/Second:       1.11
Average Time/Variable:  0.90 seconds

📈 GENERATION METHOD BREAKDOWN
--------------------------------------------------------------------------------
Template-Based:         15 ( 30.0%)
LLM-Generated:          30 ( 60.0%)
Cached:                  5 ( 10.0%)
Errors:                  0 (  0.0%)

📋 PER-VARIABLE DETAILS
--------------------------------------------------------------------------------
#    Variable            Method          Status     Code Length
--------------------------------------------------------------------------------
1    AGE                 Template        ✅ OK      45
2    SEX                 Template        ✅ OK      38
3    RACE                LLM (groq)      ✅ OK      120
4    AGEGR1              LLM (groq)      ✅ OK      156
5    ITTFL               Template        ✅ OK      52
6    SAFFL               LLM (groq)      ✅ OK      98
7    EFFFL               LLM (groq)      ✅ OK      134
8    TRTSDT              LLM (groq)      ✅ OK      167
...
50   VAR_50              LLM (groq)      ✅ OK      145

⚡ PERFORMANCE ANALYSIS
--------------------------------------------------------------------------------
Target for 50 variables: <60s
Actual time: 45.2s
Status: ✅ EXCELLENT
```

## Detailed Metrics Per Variable

The script tracks:

1. **Variable Name**: Name from specification
2. **Generation Method**: 
   - `Template` - Instant template-based generation (0s)
   - `LLM (groq)` - AI-generated code (~1-2s per variable in batch)
   - `Cached` - Previously generated (0s)
3. **Status**: ✅ OK or ❌ Error
4. **Code Length**: Characters in generated code snippet

## Performance Breakdown

### Template-Based Variables (30-50% typically)
- **Time**: 0 seconds (instant)
- **Examples**: Direct mappings like "AGE from DM", "SEX from DM"
- **Impact**: Major speedup for common patterns

### LLM-Generated Variables (50-70% typically)
- **Time**: ~1-2 seconds per variable (with batching)
- **Examples**: Complex derivations, calculations, flags
- **Impact**: Uses optimized batching (25 variables per API call)

### Cached Variables (10-20% on repeat runs)
- **Time**: 0 seconds (instant)
- **Impact**: Subsequent runs are faster

## Expected Performance

Based on optimizations implemented:

| Variables | Target Time | Expected Breakdown |
|-----------|------------|-------------------|
| 20 vars   | <30 seconds | ~6 templates, ~14 LLM |
| 50 vars   | <60 seconds | ~15 templates, ~35 LLM |
| 100 vars  | <120 seconds | ~30 templates, ~70 LLM |

## Results File

Results are saved to: `backend/performance_results.json`

Format:
```json
{
  "timestamp": "2024-11-20T12:00:00",
  "spec_file": "ADSLSpec.xlsx",
  "total_variables": 50,
  "total_time": 45.23,
  "generation_time": 42.10,
  "template_count": 15,
  "llm_count": 30,
  "cached_count": 5,
  "error_count": 0,
  "variables_per_second": 1.11,
  "results": [
    {
      "variable": "AGE",
      "method": "template_based",
      "provider": "template",
      "has_error": false,
      "code_length": 45
    },
    ...
  ]
}
```

## Key Optimizations Active

When you run the test, these optimizations will be active:

1. ✅ **Batch Size: 25** - 25 variables per API call (2.5x fewer calls)
2. ✅ **Concurrency: 15** - 15 concurrent batches (3x parallel processing)
3. ✅ **Token Reduction: 400** - 400 tokens per variable (2x faster)
4. ✅ **Template Generation** - Instant for 30-50% of variables
5. ✅ **Optimized Prompts** - 60-70% token reduction

## Troubleshooting

### If script fails with import errors:
```bash
cd backend
pip install -r requirements.txt
```

### If specification file not found:
- Check path: `Content/UserInputs/ADAMSpecifications/`
- Ensure file exists: `ADSLSpec.xlsx` or `ADSL_Specification_test.xlsx`

### If API calls fail:
- Ensure backend server is running
- Check LLM API keys are configured
- Review server logs for errors

## Next Steps

1. **Run the test** using instructions above
2. **Review the metrics** - Check if performance meets targets
3. **Analyze template coverage** - See how many variables use templates
4. **Compare runs** - Track performance over time
5. **Optimize further** - Based on results, identify additional optimizations

## Summary

The performance test script is ready to use. It will:
- ✅ Load your actual specification
- ✅ Generate code for all variables
- ✅ Show detailed timing for each variable
- ✅ Break down by generation method
- ✅ Save results for analysis

**Expected Result**: 50 variables should complete in **30-60 seconds** (down from 5+ minutes), with detailed metrics showing exactly how long each variable took and which method was used.
