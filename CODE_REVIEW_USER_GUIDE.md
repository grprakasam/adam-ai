# Code Review Workflow - User Guide

## Overview

The Code Review tab provides a professional interface for clinical domain experts to review, approve, and comment on generated ADAM code before final consolidation. This guide explains how to use the code review functionality effectively.

## Quick Start

### Access Code Review
1. Generate code snippets in the **Pair Programming** tab
2. Click the **"2. Code Review"** button in the workflow navigation
3. Or navigate directly using the top navigation menu

### Basic Workflow
```
Pair Programming (Generate Code)
         ↓
    Code Review (Approve Code)
         ↓
Consolidated Code (Generate Final Program)
```

---

## Code Review Interface

### Main Components

#### 1. **Status Summary Header**
Located at the top of the screen, shows:
- **Total Variables**: Number of variables in review
- **Approved**: Count of approved variables
- **Pending**: Count of variables awaiting review
- **Changes Requested**: Count needing modifications

**Color Indicators:**
- 🟢 Green: Approved
- 🟡 Yellow: Pending Review
- 🔴 Red: Changes Requested

#### 2. **Variables Table**
Lists all variables with columns:
- **Variable Name**: ADAM variable code (e.g., AGEGR1, SAFFL)
- **Label**: Human-readable variable description
- **Type**: Data type (Char, Num, Date)
- **Status**: Current approval status
- **Has Pseudo-Code**: ✓ if pseudo-code is available

**Interactions:**
- Click any row to view full details in the Details Panel
- Search/filter to find specific variables
- Sort by any column

#### 3. **Details Panel**
Shows comprehensive information for selected variable:

**Sections:**
- **Derivation Logic**: Plain English description of how variable is calculated
- **Pseudo-Code**: Step-by-step algorithm (domain expert readable)
- **Generated Code**: Actual R or SAS code snippet
- **Comments**: All reviewer feedback for this variable
- **User Notes**: Original notes from code generation

#### 4. **Approval Actions**
Bottom of Details Panel provides three key actions:

**Approve Button** (Green)
- Marks variable as approved
- Required before consolidated code generation
- Optional approval comments can be added

**Request Changes Button** (Red)
- Indicates issues or modifications needed
- Prevents consolidated code generation until resolved
- Include detailed comments explaining required changes

**Add Comment Button**
- Add reviewer feedback without changing approval status
- Useful for suggestions or clarifications
- Multiple comments per variable allowed

---

## Detailed Workflow Steps

### Step 1: Review Variable Information

**For each variable:**

1. **Click the variable row** to load details
2. **Read the derivation logic** - Understand the business logic
3. **Review the pseudo-code** - Verify algorithm correctness
4. **Examine the generated code** - Check implementation quality
5. **Check existing comments** - See prior feedback

### Step 2: Evaluate Code Quality

**Check for:**
- ✅ Correct SDTM domain references
- ✅ Proper variable handling and transformations
- ✅ ADAM naming conventions compliance
- ✅ Edge case handling
- ✅ Performance considerations
- ✅ Readability and maintainability

### Step 3: Add Comments (Optional)

**When to comment:**
- Request clarification on logic
- Suggest alternative approaches
- Note concerns without rejection
- Provide domain expertise insights

**Comment example:**
> "Please verify handling of missing values in ADVS domain. Current logic may lose records if AVAL is null. Recommend checking source data."

### Step 4: Make Approval Decision

**Three options:**

#### ✅ Approve
- Variable is ready for consolidation
- Code meets quality standards
- No changes needed
- Optional: Add approval comment

**When to approve:**
- Code is correct and complete
- All logic verified
- No concerns identified
- Ready for production

**Example:** "Approved. Logic correctly implements age categorization per statistical analysis plan."

#### 🔄 Request Changes
- Code needs modifications before approval
- Clearly state what needs to change
- Provides feedback to development team
- Variable excluded from consolidated code until resolved

**When to request changes:**
- Logic error identified
- Missing edge cases
- Incorrect SDTM reference
- Doesn't match specification

**Example:** "Request changes - SDTM domain reference should be LB not VS. Verify source for lab parameters."

#### 💬 Comment Only
- Provide feedback without blocking approval
- Useful for suggestions or clarifications
- Variable approval status unchanged
- Builds audit trail

**When to comment:**
- Suggestion for improvement
- Question about approach
- General feedback
- Knowledge sharing

---

## Search and Filter

### Finding Variables

**Search by Name:**
- Type variable name (e.g., "AGEGR1")
- Searches across variable names and labels
- Real-time filtering

**Filter by Status:**
- **Pending** - Not yet reviewed
- **Approved** - Ready for consolidation
- **Changes Requested** - Needs modification

**Combine Search + Filter:**
Example: Search "AGE" + Filter "Pending" to find all age-related variables needing review

### Quick Navigation
- Arrow keys: Move between variables
- Enter: Open selected variable details
- Escape: Close details panel

---

## Best Practices

### 1. **Systematic Review**
- Review variables in order (don't skip)
- Complete one variable before moving to next
- Take notes on patterns or issues

### 2. **Leverage Pseudo-Code**
- Read pseudo-code first (highest level)
- Then review actual code
- Compare if they match intent

### 3. **Check SDTM References**
- Verify domain codes (DM, LB, VS, etc.)
- Confirm variable names match source
- Check derivation paths are correct

### 4. **Collaborative Review**
- Use comments for knowledge sharing
- Ask questions if logic unclear
- Provide constructive feedback
- Reference specification sections when requesting changes

### 5. **Efficient Workflow**
- Approve similar variables quickly once pattern verified
- Request batch changes for common issues
- Use comments to note non-critical suggestions

### 6. **Prepare for Consolidation**
- Ensure all critical variables approved
- Document any deviations in comments
- Summarize review findings
- Ready to proceed when all variables approved

---

## Study Switching Protection

### What Happens When You Switch Projects?

**If no active review:**
- Immediate switch to new project
- No confirmation needed

**If review is IN_PROGRESS:**
- Confirmation dialog appears
- Two options:
  - **Continue Review** (Recommended) - Stay in current review, don't switch
  - **Discard Review** (Caution) - Switch projects, lose review progress

### Protecting Your Work

The system prevents accidental loss of review work:
- Cannot switch projects mid-review
- Must explicitly choose to discard
- Dialog shows warning message

**Note:** Review progress is not auto-saved. Switching projects will discard all unapproved changes.

---

## Warning Banner on Consolidated Code Tab

### What It Means

When you navigate to the Consolidated Code tab while a code review is in progress, you'll see:

**Banner Message:**
> "Code Review In Progress — Review in progress - Complete the review before generating final code."

### Implications

- ✅ **Does NOT block** code generation (soft warning)
- ⚠️ **Indicates** code review is still active
- 📝 **Reminds** to complete review first
- 🔄 **Disappears** automatically when review completes

### Recommendation

Complete code review before generating consolidated code to ensure:
- All variables are approved
- No "Changes Requested" items remain
- Consolidated code reflects all feedback
- Final program meets quality standards

---

## Workflow Navigation

### Navigate Between Steps

**Three buttons in workflow navigation bar:**

1. **Back Button** (← Arrow)
   - Go to previous step in workflow
   - From Code Review → Pair Programming
   - Disabled on first step

2. **Progress Indicator**
   - Shows position in workflow (1 of 3)
   - Current step name
   - Visual progress dots

3. **Forward Button** (→ Arrow)
   - Go to next step in workflow
   - From Code Review → Consolidated Code
   - Disabled on last step

### Complete Workflow Path
```
[1] Pair Programming
       ↓ (Forward)
[2] Code Review (YOU ARE HERE)
       ↓ (Forward)
[3] Consolidated Code
```

### Why This Workflow?

1. **Pair Programming**: Generate initial code snippets
2. **Code Review**: Approve/critique each variable
3. **Consolidated Code**: Generate final program with all approvals

---

## Troubleshooting

### Issue: Variables Not Loading
**Solution:**
- Ensure variables were generated in Pair Programming tab
- Refresh the page
- Check for console errors (F12)

### Issue: Cannot Add Comments
**Solution:**
- Ensure variable is selected (row highlighted)
- Check internet connection
- Try refreshing the page

### Issue: Cannot Change Approval Status
**Solution:**
- Ensure you have reviewer permissions
- Variable must be selected
- Check for validation errors in console

### Issue: Review Progress Lost
**Solution:**
- Review progress is session-based
- Do not switch projects during active review
- Use "Continue Review" when prompted
- Refresh page if dialog appears unexpectedly

### Issue: Workflow Navigation Hidden
**Solution:**
- Workflow nav only shows on main coding tabs
- Must be on: Pair Programming, Code Review, or Consolidated Code
- Not visible on Validation or Utilities tabs

---

## Tips for Effective Reviews

### Domain Expert Review Checklist

**Business Logic:**
- [ ] Derivation logic matches specification
- [ ] All required conditions checked
- [ ] Edge cases handled appropriately
- [ ] Variable relationships correct

**ADAM Compliance:**
- [ ] Variable naming follows CDISC standards
- [ ] SDTM domain references correct
- [ ] Required ADAM variables included
- [ ] Metadata complete (labels, formats)

**Code Quality:**
- [ ] Code is readable and maintainable
- [ ] Comments explain complex logic
- [ ] No redundant or dead code
- [ ] Performance acceptable

**Data Integrity:**
- [ ] Missing value handling correct
- [ ] Data type conversions safe
- [ ] Precision preserved for numerics
- [ ] String handling robust

### Common Issues to Watch For

1. **SDTM Domain Mix-up**: Variables from wrong domain
2. **Missing Logic**: Incomplete implementation of specification
3. **Type Mismatches**: Character vs numeric issues
4. **Missing Values**: Not properly handled in derivation
5. **Performance**: Inefficient grouping or sorting
6. **Naming**: Doesn't follow CDISC conventions

### Efficient Review Techniques

1. **Pattern Recognition**: Once you approve similar variables, apply same logic
2. **Batch Comments**: Group feedback for same issue across multiple variables
3. **Focus Areas**: Prioritize high-risk or complex variables first
4. **Documentation**: Keep notes on deviations from standard patterns
5. **Team Communication**: Share findings that may affect other variables

---

## Exporting Review Results

### PDF Export (Planned)

Coming soon: Export complete review report as PDF including:
- Variable summary with approval statuses
- All comments and feedback
- Review timestamps
- Reviewer information

### Current Options

- Copy code snippets directly from Details Panel
- Export consolidated code when ready
- Comments stored in review session

---

## Advanced Features

### Pseudo-Code Interpretation

**The pseudo-code is designed to be:**
- Readable to clinical domain experts (not just programmers)
- Step-by-step (easy to follow logic)
- Precise (exactly matches generated code)

**Example pseudo-code:**
```
IF Age < 18 THEN
  Category = "Pediatric"
ELSE IF Age < 65 THEN
  Category = "Adult"
ELSE
  Category = "Elderly"
END IF
```

This means the generated code does exactly these conditions in this order.

### Comment History

All comments are timestamped and stored. Multiple comments on same variable build a history of feedback and improvements.

### Session Persistence

Your review session is maintained during the current browser session. To protect your work:
- Don't close browser tab without saving progress
- Don't switch projects mid-review without explicit confirmation
- Review will be discarded if you log out

---

## Getting Help

For questions about code review:
1. Check this guide
2. Contact your administrator
3. Refer to CDISC ADAM Implementation Guide
4. Review specification document

---

## Summary

The Code Review interface provides a professional, efficient workflow for clinical domain experts to review ADAM code before final generation. By following this guide and best practices, you can ensure high-quality, specification-compliant ADAM datasets.

**Key Takeaways:**
- ✅ Review each variable systematically
- ✅ Use pseudo-code as reference
- ✅ Approve or request changes explicitly
- ✅ Add comments for team collaboration
- ✅ Complete review before consolidation
- ✅ Use workflow navigation to maintain focus

Happy reviewing!
