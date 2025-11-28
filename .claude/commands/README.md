# Slash Commands Reference

This directory contains custom slash commands for the ADAM AI project.

## Available Commands

### `/prak-plan`
**Purpose**: Create implementation plans for new features while preserving existing functionality

**When to use**:
- Planning major feature additions
- Designing new components or modules
- Architecting system-wide changes

**Output**: `Context/My_Initial_Plan.md`

---

### `/prak-review`
**Purpose**: Review and refine implementation plans to ensure completeness and alignment

**When to use**:
- After creating an initial plan with `/prak-plan`
- To validate plan against requirements
- To identify gaps and risks in proposed approach

**Output**: `Context/My_Revised_Plan.md`

---

### `/prak-improvise`
**Purpose**: Conduct infrastructure and technical production readiness review

**Focus Areas**:
- 10 Production Infrastructure Issues (performance, security, scalability, concurrency)
- 5 Technical Integration Issues (LLM providers, databases, APIs, file systems)

**When to use**:
- Before production deployment
- To identify technical risks and bottlenecks
- To assess backend/infrastructure readiness

**Output**: `Context/My_Production_Review_Report.md`

**Review Type**: Technical/Infrastructure

---

### `/prak-functional-reviews` ⭐ NEW
**Purpose**: Simulate clinical trials workflows and identify functional/UX issues

**Focus Areas**:
- Statistician workflow (spec upload → code generation → testing)
- Programmer validation workflow
- QC reviewer workflow
- Regulatory submission preparation
- Multi-study management

**When to use**:
- To assess user experience and usability
- To identify workflow gaps and design issues
- To validate application from end-user perspective
- Before major UI/UX releases

**Output**: `Context/My_Functional_Review_Report.md`

**Review Type**: Functional/UX/Design

**Key Difference from `/prak-improvise`**:
- `/prak-improvise` → Backend/infrastructure/technical issues
- `/prak-functional-reviews` → Frontend/UX/workflow/design issues

---

## Usage Examples

### Infrastructure Review
```bash
# Type in Claude Code:
/prak-improvise

# Generates report with issues like:
# - Memory exhaustion in SDTM generation
# - SQL injection vulnerabilities
# - Race conditions in concurrent requests
# - LLM API rate limit handling
# - Database connection pooling
```

### Functional/UX Review
```bash
# Type in Claude Code:
/prak-functional-reviews

# Generates report with issues like:
# - No visual indicator for variable approval status
# - Confusing navigation between tabs
# - Missing progress feedback during code generation
# - Unclear error messages for specification format issues
# - No way to save work-in-progress
```

---

## Command Comparison

| Aspect | `/prak-improvise` | `/prak-functional-reviews` |
|--------|-------------------|---------------------------|
| **Focus** | Infrastructure & Technical | UX & Workflows |
| **Issues Count** | 10 + 5 = 15 | 5 (deep dive) |
| **Target Users** | DevOps, Backend Developers | Frontend Developers, UX Designers |
| **Review Depth** | Broad technical coverage | Deep workflow simulation |
| **Output Examples** | "OOM crashes", "SQL injection" | "Confusing UI", "Missing feedback" |
| **Files Reviewed** | Backend Python, APIs, DB | Frontend React, Components |
| **Proposed Fixes** | Code changes, architecture | UI/UX improvements, mockups |

---

## Best Practice Workflow

1. **Before Major Release**:
   ```
   Step 1: /prak-improvise           → Fix technical issues
   Step 2: /prak-functional-reviews  → Fix UX issues
   Step 3: Deploy with confidence
   ```

2. **For New Features**:
   ```
   Step 1: /prak-plan                → Create plan
   Step 2: /prak-review              → Validate plan
   Step 3: Implement
   Step 4: /prak-functional-reviews  → Test usability
   ```

3. **Production Readiness**:
   ```
   Step 1: /prak-improvise           → Infrastructure audit
   Step 2: /prak-functional-reviews  → UX audit
   Step 3: Fix critical issues
   Step 4: Deploy to production
   ```

---

## Output Files

All review reports are saved in the `Context/` directory:

- `Context/My_Initial_Plan.md` - Initial feature plan
- `Context/My_Revised_Plan.md` - Reviewed and refined plan
- `Context/My_Production_Review_Report.md` - Infrastructure review
- `Context/My_Functional_Review_Report.md` - UX/workflow review

---

## Tips for Best Results

### For Infrastructure Reviews (`/prak-improvise`)
- Focus on production scenarios (1000+ users, concurrent requests)
- Consider security, performance, scalability
- Look at backend code, APIs, database usage

### For Functional Reviews (`/prak-functional-reviews`)
- Think like a clinical trials statistician/programmer
- Simulate complete end-to-end workflows
- Focus on UI confusion, missing features, workflow breaks
- Look at frontend components, navigation, user feedback

---

## Adding New Commands

To create a new slash command:

1. Create a new `.md` file in `.claude/commands/`
2. Add frontmatter with description:
   ```markdown
   ---
   description: Brief description of what this command does
   ---
   ```
3. Write detailed instructions for Claude
4. The command name = filename (without `.md`)

Example: `.claude/commands/my-command.md` → `/my-command`
