# Approved Decisions Summary – Pseudo-Code & Code Review Feature

**Date:** 2025-11-25
**Status:** ✅ APPROVED BY PRODUCT OWNER
**Reference:** My_Revised_Plan.md (Section 4)

---

## Quick Reference: 8 Key Decisions

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Pseudo-code depth? | Step-by-step, easily readable with plain English | Clear for domain experts; captures derivation logic |
| 2 | Consolidated code gating? | Soft warning (not hard-blocked) | Flexibility for teams; best-practice nudge |
| 3 | Approval granularity? | Per-variable level | Fine-grained traceability; clear status per variable |
| 4 | Multi-user & auth? | Best approach based on current implementation; single-user for MVP | Defer multi-user to v2 when auth is ready |
| 5 | PDF export? | Optimized for variable-level readability | Clinical-grade documentation; regulatory-suitable |
| 6 | CodeReviewTab executor? | Deprecate (remove entirely) | R Frontend tab handles execution; Code Review handles review |
| 7 | Study switching mid-review? | Disabled; prompt to save/discard | Prevent accidental data loss; clear mental model |
| 8 | Performance targets? | No targets for MVP; optimize post-launch | Real-world monitoring drives v2 optimizations |

---

## Implementation Implications

### 1. Pseudo-Code Generation

**What this means:**
- Backend LLM prompt must generate step-by-step logic, not just a summary
- Frontend displays full pseudo-code in Pair Programming (visible by default)
- Use plain English with indentation and logical keywords
- Monospaced font for readability

**Files affected:**
- `backend/app/program_generation/code_generator.py` – prompt design
- `frontend/src/components/PairProgrammingArea.tsx` – display logic
- `frontend/src/components/PairProgrammingArea.css` – styling

---

### 2. Consolidated Code Soft Warning

**What this means:**
- Users CAN generate consolidated code even if review is not APPROVED
- Banner warning shown: "Review in progress – status: [status]"
- No workflow blocking; recommendation only
- Allows draft consolidations and team flexibility

**Files affected:**
- `frontend/src/components/ConsolidatedCodeTab.tsx` – add warning banner
- Logic in `RightPanel.tsx` – status awareness

---

### 3. Per-Variable Approval

**What this means:**
- Each variable has its own review status (PENDING | APPROVED | CHANGES_REQUESTED)
- Session is APPROVED only when ALL variables are APPROVED
- Code Review tab shows table with per-variable status columns
- Users approve/reject variable-by-variable

**Files affected:**
- `frontend/src/store/projectStore.ts` – add variable-level status fields
- `frontend/src/components/CodeReviewTab.tsx` – table with status controls
- Backend schema – variable snapshots with status tracking

---

### 4. Single-User Review (MVP)

**What this means:**
- No user authentication assumed for MVP
- Comment threads not implemented (single comment per variable)
- Multi-user workflows deferred to v2
- Build for extensibility (can add auth/roles later)

**Files affected:**
- `frontend/src/components/CodeReviewTab.tsx` – simple comment UI
- `backend/app/api/code_review_routes.py` – comment endpoints (no user tracking)

---

### 5. Variable-Level PDF Export

**What this means:**
- PDF has one variable per page (or logical grouping)
- Per-variable: name, derivation, pseudo-code, code, notes, status, comments
- Professional layout suitable for regulatory documentation
- Footer with study, dataset, language, timestamp

**Files affected:**
- Backend PDF generation service (new or enhanced)
- Template/formatting logic

---

### 6. Deprecate CodeReviewTab Executor

**What this means:**
- Remove the current R/SAS executor from CodeReviewTab
- Replace entirely with variable-centric review UI
- Users who need execution go to R Frontend tab
- No backward compatibility needed (new feature, not existing feature)

**Files affected:**
- `frontend/src/components/CodeReviewTab.tsx` – complete rewrite
- `frontend/src/components/CodeReviewTab.css` – new styling

---

### 7. Disable Mid-Review Study Switching

**What this means:**
- When user tries to switch studies, prompt appears
- Options: Save & switch (loads new study review) or Discard & switch
- Prevents accidental loss of review feedback
- Clear user intent required to abandon review

**Files affected:**
- `frontend/src/components/LandingPage.tsx` or study selector – confirmation dialog
- `frontend/src/store/projectStore.ts` – save/clear logic on study switch

---

### 8. No Performance Targets (MVP)

**What this means:**
- Start with basic table rendering (no virtualization)
- Monitor actual usage post-launch
- Add pagination/virtualization in v2 if needed (e.g., tables > 50 variables)
- Use real data to drive optimization decisions

**Implementation:**
- Build for simplicity first
- Add logging/monitoring for load times
- Create GitHub issues for v2 perf improvements if needed

---

## Revised Timeline (Phase Breakdown)

Based on approved decisions:

| Phase | Weeks | Focus |
|-------|-------|-------|
| **Phase 1** | 1-2 | Backend pseudo-code generation with step-by-step logic |
| **Phase 2** | 2-3 | Frontend Pair Programming UI enhancement for pseudo-code display |
| **Phase 3** | 3-4 | Backend code review infrastructure (per-variable status) |
| **Phase 4** | 4-5 | Frontend Code Review tab rewrite (variable table, no executor) |
| **Phase 5** | 5-6 | Navigation, study switching guard, PDF export |
| **Phase 6** | 6-7 | Testing, bug fixes, UI polish, deprecation cleanup |

**Total:** 6-7 weeks to production-ready MVP

---

## What Changed vs. Initial Plan

### ✅ Simplified

1. **Pseudo-Code Format:** Fixed on step-by-step readable format (no format variations)
2. **CodeReviewTab:** Complete replacement (not partial integration with executor)
3. **Study Switching:** Guard rails in place (not complex persistence logic)
4. **Performance:** Baseline implementation (not virtualization upfront)

### ✅ Clarified

1. **Soft Warning:** Explicit on Consolidated Code (not "discuss with product")
2. **PDF Export:** Defined per-variable layout (not generic export)
3. **Approval Workflow:** Per-variable granularity confirmed
4. **Multi-User:** Deferred to v2 (not a blocker for MVP)

### ✅ De-Scoped (for MVP)

1. Multi-user approval workflows → v2
2. Line-level code comments → v2
3. 21 CFR Part 11 compliance → v2
4. Performance optimization (virtualization) → v2

---

## What's Ready for Implementation

✅ **Backend**
- Clear LLM prompt design for pseudo-code
- Per-variable status model
- PDF export spec
- API endpoints finalized

✅ **Frontend**
- UI mockups for Code Review table
- Pseudo-code display in Pair Programming
- Study switching confirmation dialog
- Soft warning banner for Consolidated Code

✅ **Testing**
- Acceptance criteria defined
- Regression test scenarios identified
- No new edge cases introduced by decisions

---

## Next Steps (Post-Approval)

1. **Finalize Backend Prompt (24 hours)**
   - LLM engineer reviews pseudo-code prompt
   - Test with sample derivations
   - Approve for implementation

2. **Finalize UI Mockups (24 hours)**
   - Designer creates Code Review table mockup
   - Get feedback from domain expert
   - Finalize look & feel

3. **Implementation Kickoff (Day 3)**
   - Assign owners: Backend lead (Phase 1-3), Frontend lead (Phase 2,4-5)
   - Set up branches and CI/CD
   - Create detailed Jira issues
   - Daily standups, weekly demos

4. **Launch Readiness (Week 6-7)**
   - Full regression testing
   - UAT with domain experts
   - Documentation & release notes
   - Production deployment plan

---

## Decision Ownership & Accountability

- **Product Owner:** Approved all 8 decisions ✅
- **Backend Lead:** Responsible for pseudo-code generation quality
- **Frontend Lead:** Responsible for Code Review UX
- **QA Lead:** Verify acceptance criteria
- **DevOps:** Database migrations, deployment readiness

---

**Document Status:** Finalized & Ready for Implementation
**Version:** 1.0
**Last Updated:** 2025-11-25
