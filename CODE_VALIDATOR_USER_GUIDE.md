# Code Validator Tab - User Guide

## Overview

The Code Validator tab helps you validate LLM-generated R/SAS code snippets in a sandboxed Docker environment with optional SDTM test datasets.

## Getting Started

### Step 1: Upload Test Datasets (One-time Setup)

1. Click the **"Upload"** button in the "Test Datasets" card
2. In the upload modal:
   - **Drag and drop** your SDTM files or click to browse
   - Supported formats: `.xpt`, `.sas7bdat`, `.csv`, `.txt`
   - Max file size: 100MB per file
3. Enter a **dataset name** (e.g., `PHASE3_STUDY123`)
4. (Optional) Add a description
5. Click **"Upload"**

**Example:**
```
Dataset Name: PHASE3_STUDY123
Description: Phase 3 SDTM datasets for Study ABC-123
Files:
  - ADSL.xpt (2.5 MB)
  - DM.xpt (1.8 MB)
  - VS.xpt (5.2 MB)
  - AE.xpt (3.1 MB)
```

### Step 2: Select a Dataset (or None)

In the "Test Datasets" card, you'll see:
- ⭕ **No Dataset (Validation Only)** - For syntax-only checks
- ⭕ **Your Uploaded Datasets** - Each showing:
  - Dataset name
  - Number of files
  - Total size
  - Upload date
  - File list

**Select one option:**
- Click the radio button to select a dataset
- Select "No Dataset" for syntax-only validation

### Step 3: Select a Code Snippet

In the "Select Snippets" card:
- View all approved code snippets from Pair Programming
- Click on a snippet to load it into the editor
- The snippet will appear in the Monaco code editor

### Step 4: (Optional) Edit the Code

In the center panel:
- Edit the code in the Monaco editor
- Syntax highlighting for R/SAS
- Auto-completion enabled

### Step 5: Execute the Code

1. **Set Timeout** (optional):
   - Default: 1 minute
   - Options: 30 seconds, 1 minute, 5 minutes

2. **Quick Check** (optional):
   - Click "Quick Check" for syntax-only validation
   - No Docker execution
   - Fast results

3. **Execute**:
   - Click the **"Execute"** button
   - Code runs in Docker container
   - If dataset selected, it's mounted at `/data`

### Step 6: View Results

Results appear in tabbed panels:

#### Console Tab
- Standard output from execution
- Print statements
- Dataset loading messages
- Session info

#### Errors Tab
- Compilation errors
- Runtime errors
- Error messages with line numbers

#### Warnings Tab
- Warning messages
- Deprecation notices

#### Performance Tab
- Execution time
- Memory usage (if available)
- CPU usage (if available)

## Working with Datasets in R Code

When a dataset is selected, your R code has access to:

### List Available Datasets
```r
# Lists all files in /data directory
dataset_files <- list.files("/data", pattern = "\\.(xpt|sas7bdat|csv|txt)$", full.names = TRUE)
print(dataset_files)
```

### Load Datasets
```r
# Use the helper function (automatically injected)
adsl <- load_dataset("ADSL.xpt")
dm <- load_dataset("DM.xpt")
vs <- load_dataset("VS.xpt")

# Or load manually
library(haven)
adsl <- read_xpt("/data/ADSL.xpt")
```

### Example Code Snippet
```r
# Load ADSL dataset
adsl <- load_dataset("ADSL.xpt")

# Check dimensions
cat("ADSL dimensions:", dim(adsl), "\n")

# View first few rows
print(head(adsl))

# Check for required variables
required_vars <- c("USUBJID", "AGE", "SEX", "RACE")
missing_vars <- setdiff(required_vars, names(adsl))

if (length(missing_vars) > 0) {
  stop("Missing variables: ", paste(missing_vars, collapse = ", "))
}

# Basic summary
summary(adsl[, c("AGE", "SEX")])
```

## Managing Datasets

### Refresh Dataset List
- Click the 🔄 **Refresh** button to reload the dataset list
- Useful after uploading new datasets

### Delete Dataset
1. Click the 🗑️ **Delete** button on a dataset card
2. Confirm deletion in the popup
3. Dataset and all files will be removed

### View Dataset Details
Each dataset card shows:
- **Name**: Dataset identifier
- **Description**: Optional description
- **File Count**: Number of files (e.g., "4 files")
- **Total Size**: Combined size (e.g., "12.6 MB")
- **Upload Date**: When dataset was uploaded
- **File List**: Individual files with sizes

## Tips and Best Practices

### Dataset Organization
- Use clear, descriptive names (e.g., `PHASE3_STUDY123`, `PILOT_STUDY_ABC`)
- Group related SDTM domains in one dataset
- Add descriptions for context

### Code Execution
- **Start with "Quick Check"** to catch syntax errors before full execution
- **Use shorter timeouts** for simple validation (30s)
- **Use longer timeouts** for complex computations (5m)
- **Select "No Dataset"** when testing code logic without data

### Resource Limits
- Each execution is limited to:
  - **Memory**: 2GB
  - **CPU**: 2 cores
  - **Timeout**: User-configurable (30s - 5m)
  - **Network**: Disabled (security)

### Security
- Datasets are mounted **read-only** (cannot be modified)
- Code runs in isolated Docker container
- No network access
- Container removed after execution

### Troubleshooting

**"Docker is not available"**
- Start Docker Desktop
- Click the 🔄 refresh icon next to "Docker Unavailable"

**"Execution timeout"**
- Increase timeout setting
- Simplify code or reduce data processing

**"Dataset not found"**
- Refresh dataset list
- Re-upload dataset if deleted
- Check dataset name in code

**"File format not supported"**
- Only `.xpt`, `.sas7bdat`, `.csv`, `.txt` are supported
- Convert files to supported format

**"File too large"**
- Maximum 100MB per file
- Split large files or compress data

## Workflow Example

### Scenario: Validate AGE Derivation Logic

1. **Upload Dataset** (one-time):
   ```
   Name: DM_BASELINE_STUDY123
   Files: DM.xpt (2.1 MB)
   ```

2. **Select Dataset**: Choose "DM_BASELINE_STUDY123"

3. **Select Snippet**: "AGE Derivation"

4. **Edit Code** (if needed):
   ```r
   # Load DM dataset
   dm <- load_dataset("DM.xpt")
   
   # Derive AGE from BRTHDTC and RFICDTC
   dm <- dm %>%
     mutate(
       AGE = floor(as.numeric(difftime(
         as.Date(RFICDTC), 
         as.Date(BRTHDTC), 
         units = "days"
       )) / 365.25)
     )
   
   # Check AGE values
   cat("AGE summary:\n")
   summary(dm$AGE)
   
   # Check for missing or invalid values
   cat("\nMissing AGE:", sum(is.na(dm$AGE)), "\n")
   cat("Negative AGE:", sum(dm$AGE < 0, na.rm = TRUE), "\n")
   cat("AGE > 120:", sum(dm$AGE > 120, na.rm = TRUE), "\n")
   ```

5. **Set Timeout**: 1 minute (default)

6. **Execute**: Click "Execute"

7. **Review Results**:
   - **Console**: Check summary statistics
   - **Errors**: Verify no errors
   - **Warnings**: Check for warnings
   - **Performance**: Verify execution time

8. **If Issues Found**:
   - Edit code to fix logic
   - Re-execute
   - Iterate until validation passes

## Keyboard Shortcuts (Monaco Editor)

- `Ctrl + Space`: Trigger auto-completion
- `Ctrl + /`: Toggle comment
- `Ctrl + F`: Find
- `Ctrl + H`: Find and replace
- `Alt + Up/Down`: Move line up/down
- `Ctrl + D`: Select next occurrence
- `F1`: Command palette

## Status Indicators

- 🟢 **Docker Ready**: Docker is available and configured
- 🔴 **Docker Unavailable**: Docker needs to be started
- ⚪ **Checking...**: Verifying Docker status
- ✅ **Passed**: Execution successful, no errors
- ⚠️ **Failed**: Execution completed with errors
- ❌ **Error**: Execution failed (timeout, crash, etc.)

## Common Use Cases

### 1. Syntax Validation
- **Select**: "No Dataset (Validation Only)"
- **Purpose**: Quick syntax check without execution
- **Time**: < 1 second

### 2. Logic Validation with Sample Data
- **Select**: Small test dataset
- **Purpose**: Verify derivation logic on sample records
- **Time**: 5-30 seconds

### 3. Full Validation with Production Data
- **Select**: Full SDTM datasets
- **Purpose**: Comprehensive validation with real data
- **Time**: 30 seconds - 5 minutes

### 4. Iterative Development
1. Start with syntax check (Quick Check)
2. Run with sample data (1 dataset, 100 records)
3. Run with full data (all datasets)
4. Review performance metrics
5. Optimize if needed

## Support and Feedback

For issues or questions:
- Check console output for error details
- Review warning messages
- Verify dataset files are accessible
- Check Docker status
- Increase timeout if needed

## Summary

The Code Validator tab provides a complete workflow for:
1. 📤 **Upload** test datasets (one-time)
2. 📂 **Select** dataset or validation-only mode
3. 📝 **Edit** code snippets in Monaco editor
4. ▶️ **Execute** in sandboxed Docker environment
5. 📊 **Review** results in tabbed interface
6. 🔄 **Iterate** until validation passes

This streamlined workflow eliminates repetitive uploads and provides immediate feedback on code quality and correctness.
