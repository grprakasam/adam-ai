# ADAM Generator - Execute Button Guide

## Button Locations

### 1. Small "Run" Button (Editor Toolbar)
- **Location**: Top-right corner of the R Program Editor
- **Look for**: Purple gradient button with play icon ▶️
- **Shortcut**: Ctrl+Enter or Cmd+Enter

### 2. Large "Run R Program" Button (Execution Control)
- **Location**: "Execution Control" card header (right side)
- **Look for**: Large purple button next to dataset count tag
- **More prominent** and easier to see

## Why Button is Disabled (Grayed Out)

The execute button is **disabled** until ALL these requirements are met:

### ✅ Requirement 1: R Code Present
- Editor must have code (not empty)
- **Fix**: Add any R code, even just `print("test")`

### ✅ Requirement 2: Study ID Configured
- Set in the Setup tab or left panel
- **Fix**: Go to project configuration and set Study ID

### ✅ Requirement 3: ADAM Dataset Selected
- Must select target dataset (ADSL, ADAE, ADLB, etc.)
- **Fix**: Choose dataset from dropdown in configuration

### ⚠️ Requirement 4: SDTM Data Loaded (MOST COMMON ISSUE)
- Required SDTM domains must be available
- Shows as warning: "X missing domains"
- **Fix**: Click "Load SDTM Data" button in Execution Control card

## Step-by-Step Fix

### Step 1: Load SDTM Test Data
1. Go to **SDTM Generator** tab
2. Generate required domains (DM, DS, etc.)
3. Return to **ADAM Generator** tab
4. Click **"Load SDTM Data"** button in Execution Control

### Step 2: Verify Prerequisites
Check the Execution Control card shows:
```
✓ Study ID: [your-study-id]
✓ Dataset: [ADSL/ADAE/etc]
✓ N datasets loaded (green tag)
```

### Step 3: Execute
- Button should now be **enabled** (bright purple, not grayed out)
- Click "Run R Program" or press **Ctrl+Enter**

## Visual Indicators

### Button is ENABLED ✅
- **Color**: Bright purple gradient
- **Cursor**: Hand/pointer on hover
- **Text**: "Run R Program"

### Button is DISABLED ❌
- **Color**: Gray/faded
- **Cursor**: Not-allowed symbol
- **Reason**: Check alert message below button

## Common Issues

### "Cannot find button at all"
- **Scroll up** - The Execution Control card is at the top of the right panel
- **Expand panel** - Make sure right panel is not collapsed
- **Check tab** - Verify you're in "ADAM Generator" tab (not SDTM Generator)

### "Button is visible but grayed out"
- Look for alert message showing what's missing
- Most common: "Missing SDTM domains" - need to load data first

### "Button works but execution fails"
- Check if Docker is running (for R execution)
- Backend might still be starting up

## Testing the Button

Quick test code to verify execution works:
```r
# Simple test
print("Hello from R!")
x <- 1:10
summary(x)
```

This should execute successfully once all requirements are met.
