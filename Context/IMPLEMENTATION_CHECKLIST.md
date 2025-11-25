# Implementation Checklist – Pseudo-Code & Code Review Feature

**Status:** Ready for Implementation
**Approved Decisions:** See APPROVED_DECISIONS.md
**Detailed Plan:** See My_Revised_Plan.md

---

## Phase 1: Backend Pseudo-Code Generation (Weeks 1-2)

### Planning & Design

- [ ] **Finalize LLM Prompt**
  - [ ] Gather sample variable derivations from team
  - [ ] Design pseudo-code prompt (step-by-step format)
  - [ ] Test prompt with 5+ sample variables
  - [ ] Document prompt version and rationale
  - [ ] Get approval from backend lead and domain expert

- [ ] **Backend Architecture Review**
  - [ ] Identify where code generation happens: `backend/app/program_generation/code_generator.py`
  - [ ] Check if pseudo-code is already partially implemented
  - [ ] Plan error handling for LLM failures
  - [ ] Identify logging/monitoring points

### Implementation

- [ ] **Extend Code Generation Service**
  - [ ] Update `CodeSnippetResponse` type to ensure `pseudo_code` and `pseudo_summary` fields
  - [ ] Modify snippet generation to call LLM for pseudo-code
  - [ ] Add graceful degradation (return code without pseudo-code if LLM fails)
  - [ ] Add metadata: `has_pseudo_code` flag, error messages
  - [ ] Implement retry logic and timeouts

- [ ] **Update Data Models**
  - [ ] Verify `VariableSnippet` in `projectStore` has `pseudoCode` and `pseudoSummary`
  - [ ] Ensure `CodeSnippetResponse` backend type matches frontend expectations
  - [ ] Document field mapping between backend and frontend

- [ ] **Add Logging & Monitoring**
  - [ ] Log pseudo-code generation attempts
  - [ ] Track success/failure rates
  - [ ] Add performance metrics (generation time per variable)
  - [ ] Create monitoring dashboard (if available)

### Testing

- [ ] **Unit Tests**
  - [ ] Test pseudo-code generation with valid inputs
  - [ ] Test graceful failure (LLM timeout, no pseudo-code)
  - [ ] Test with various variable types (dates, flags, calculations)
  - [ ] Test error messages are user-friendly

- [ ] **Integration Tests**
  - [ ] Test end-to-end: specification → variable extraction → code + pseudo-code generation
  - [ ] Test with mock LLM response
  - [ ] Test store receives pseudo-code correctly
  - [ ] Test with different languages (R vs SAS)

- [ ] **Manual Testing**
  - [ ] Generate code for 10+ variables in test study
  - [ ] Verify pseudo-code quality (readable, captures derivation logic)
  - [ ] Check for any corrupted characters or formatting issues
  - [ ] Validate with domain expert

### Documentation

- [ ] **Backend Developer Guide**
  - [ ] Document LLM prompt design and rationale
  - [ ] Document error handling and degradation paths
  - [ ] Add code examples for extending pseudo-code generation
  - [ ] Document performance expectations

---

## Phase 2: Frontend – Pair Programming Pseudo-Code Display (Weeks 2-3)

### Design & Mockups

- [ ] **UI Design Finalization**
  - [ ] Create mockup of variable card with pseudo-code
  - [ ] Show pseudo-code placement (below derivation, above code)
  - [ ] Define styling (font, size, spacing, scroll behavior)
  - [ ] Get approval from UX designer and domain expert

- [ ] **Responsive Design**
  - [ ] Mobile (< 600px): how pseudo-code displays (collapsed, tabs, etc.)
  - [ ] Tablet (600-1200px): side-by-side or stacked layout
  - [ ] Desktop (> 1200px): full layout with all fields visible

### Implementation

- [ ] **Update PairProgrammingArea Component**
  - [ ] Add pseudo-code to `FIELD_DEFINITIONS`
  - [ ] Set `alwaysVisible: false` but `requiresSnippet: true`
  - [ ] Add logic to show pseudo-code by default when available
  - [ ] Add expand/collapse for long pseudo-code
  - [ ] Update field visibility controls

- [ ] **Styling & CSS**
  - [ ] Create `.pseudo-code-block` class:
     - Monospaced font (Courier New, Fira Code, etc.)
     - Light gray background (#f5f5f5)
     - Padding and margin for readability
     - Syntax highlighting for keywords (IF, THEN, ELSE, FOR, etc.) – optional
  - [ ] Create `.pseudo-code-summary` class for collapsed view
  - [ ] Add smooth expand/collapse animations
  - [ ] Ensure dark mode support

- [ ] **User Interactions**
  - [ ] Implement expand/collapse toggle
  - [ ] Add copy-to-clipboard button for pseudo-code (optional)
  - [ ] Preserve visibility state in localStorage (optional)

- [ ] **Integration with Store**
  - [ ] Verify `VariableSnippet.pseudoCode` and `pseudoSummary` are populated
  - [ ] Check `setBulkCodeSnippets` action maps backend response correctly
  - [ ] No store changes needed (fields already exist)

### Testing

- [ ] **Component Tests**
  - [ ] Pseudo-code renders when available
  - [ ] Pseudo-code hidden when not available
  - [ ] Expand/collapse works smoothly
  - [ ] Copy button works (if implemented)

- [ ] **Responsive Tests**
  - [ ] Mobile: readable on small screens
  - [ ] Tablet: layout adjusts properly
  - [ ] Desktop: full pseudo-code visible

- [ ] **Regression Tests**
  - [ ] Existing field visibility controls still work
  - [ ] Code snippet display not affected
  - [ ] User notes and acceptance checkboxes still functional
  - [ ] No performance degradation

- [ ] **Manual Testing**
  - [ ] Generate code for variables
  - [ ] Verify pseudo-code displays correctly
  - [ ] Check readability and formatting
  - [ ] Test with very long pseudo-code

### Documentation

- [ ] **Frontend Developer Guide**
  - [ ] Document pseudo-code component structure
  - [ ] Document styling conventions
  - [ ] Add code examples for expanding/collapsing
  - [ ] Document localStorage keys for visibility state

---

## Phase 3: Backend – Code Review Infrastructure (Weeks 3-4)

### Database Schema

- [ ] **Review Database Design**
  - [ ] Check if `CodeReviewSession` table exists
  - [ ] Design `VariableReviewSnapshot` table (or enhance existing):
    ```sql
    VariableReviewSnapshot:
      - id (PK)
      - session_id (FK → CodeReviewSession)
      - variable_name
      - variable_label
      - derivation_logic
      - pseudo_code
      - pseudo_summary
      - code_snippet
      - coding_rationale
      - user_notes_from_pair_programming
      - review_status (PENDING | APPROVED | CHANGES_REQUESTED)
      - reviewer_comments
      - created_at
      - updated_at
    ```
  - [ ] Enhance `CodeReviewComment` if needed
  - [ ] Add indexes on (session_id, variable_name) for quick lookup

- [ ] **Alembic Migration**
  - [ ] Create migration script for new/modified tables
  - [ ] Test migration on staging environment
  - [ ] Document rollback procedure
  - [ ] Verify backward compatibility

### API Implementation

- [ ] **Code Review Session Endpoints**
  - [ ] `POST /api/v1/code-review/session` (create session)
  - [ ] `GET /api/v1/code-review/session/{session_id}` (fetch session)
  - [ ] `PUT /api/v1/code-review/session/{session_id}` (update status)
  - [ ] Add validation (study_id, dataset, language)

- [ ] **Variable Snapshot Endpoints**
  - [ ] `GET /api/v1/code-review/session/{session_id}/variables` (fetch all variable snapshots)
  - [ ] `POST /api/v1/code-review/session/{session_id}/variables/{variable_name}/status` (update per-variable status)
  - [ ] Add request validation and error handling

- [ ] **Comment Endpoints**
  - [ ] `POST /api/v1/code-review/session/{session_id}/comments` (add comment)
  - [ ] `GET /api/v1/code-review/session/{session_id}/comments` (fetch comments)
  - [ ] `DELETE /api/v1/code-review/comment/{comment_id}` (delete comment)

- [ ] **PDF Export Endpoint**
  - [ ] `GET /api/v1/code-review/session/{session_id}/export-pdf` (generate PDF)
  - [ ] Return PDF binary with proper headers

### Error Handling & Validation

- [ ] **Input Validation**
  - [ ] Validate study_id, dataset, language are provided
  - [ ] Validate session exists and belongs to study
  - [ ] Validate variable_name exists
  - [ ] Prevent invalid status transitions

- [ ] **Error Messages**
  - [ ] Return clear error messages (no stack traces)
  - [ ] Log errors for debugging (internal logs only)
  - [ ] Return appropriate HTTP status codes (400, 404, 409, etc.)

### Testing

- [ ] **Unit Tests**
  - [ ] Session CRUD operations
  - [ ] Variable snapshot creation and updates
  - [ ] Status validation logic
  - [ ] Comment operations

- [ ] **Integration Tests**
  - [ ] Full workflow: create session → load snapshots → update status → add comments
  - [ ] Multi-study isolation (sessions from different studies don't mix)
  - [ ] PDF export contains expected content

- [ ] **Manual Testing**
  - [ ] Create code review session via API
  - [ ] Fetch and update variable snapshots
  - [ ] Add comments
  - [ ] Generate PDF export

### Documentation

- [ ] **API Documentation**
  - [ ] Document all endpoints (request/response format)
  - [ ] Document error codes and messages
  - [ ] Add curl examples
  - [ ] Document database schema changes

---

## Phase 4: Frontend – Code Review Tab Redesign (Weeks 4-5)

### Design & Mockups

- [ ] **Code Review Tab Mockup**
  - [ ] Create mockup of complete interface:
    - Header (study, dataset, language, status badge)
    - Filter/search bar
    - Variable table with columns
    - Details panel
  - [ ] Define responsive layouts (mobile, tablet, desktop)
  - [ ] Get approval from designer and domain expert

### Component Implementation

- [ ] **CodeReviewTab Component (Complete Rewrite)**
  - [ ] Mount: fetch projectConfig, load session, load variable snapshots
  - [ ] Render header with study/dataset/language/status
  - [ ] Render filter/search controls
  - [ ] Render variable table:
    - Columns: name, derivation, pseudo, code, notes, status, actions
    - Sorting and filtering
    - Row selection to show details
  - [ ] Render details panel:
    - Full content for selected variable
    - Status radio buttons
    - Comment text area
    - Comment history (if exists)
  - [ ] Navigation buttons: back to Pair Programming, to Consolidated Code

- [ ] **Table Implementation**
  - [ ] Use Ant Design Table component (consistent with app)
  - [ ] Implement custom columns with expandable content
  - [ ] Add row highlighting on hover/select
  - [ ] Implement inline status change buttons

- [ ] **Details Panel Implementation**
  - [ ] Show selected variable content (derivation, pseudo-code, code)
  - [ ] Status radio buttons (PENDING | APPROVED | CHANGES_REQUESTED)
  - [ ] Comment text area with "Save comment" button
  - [ ] Display existing comments

- [ ] **Store Integration**
  - [ ] Call `loadCodeReviewSession()` on mount
  - [ ] Call `loadVariableSnapshots()` to get data
  - [ ] Call `updateVariableReviewStatus()` when status changes
  - [ ] Call `addComment()` / `updateComment()` for comments
  - [ ] Update UI based on store state

### Styling & CSS

- [ ] **CodeReviewTab.css**
  - [ ] Table styling (borders, spacing, hover effects)
  - [ ] Details panel styling (cards, form inputs)
  - [ ] Header styling (badges, buttons)
  - [ ] Responsive breakpoints
  - [ ] Dark mode support

### User Interactions

- [ ] **Filter & Search**
  - [ ] Filter by review status (checkboxes)
  - [ ] Text search on variable name/label
  - [ ] Clear filters button
  - [ ] Live filtering (as user types)

- [ ] **Approval Workflow**
  - [ ] Click row to select variable
  - [ ] Change status via radio buttons or inline buttons
  - [ ] Save immediately (or batch save)
  - [ ] Show confirmation feedback

- [ ] **Comment Management**
  - [ ] Add comment in details panel
  - [ ] Display comment history
  - [ ] Delete comment (if needed)
  - [ ] Edit comment (v2 feature)

- [ ] **Navigation**
  - [ ] "← Back to Pair Programming" button (dispatch navigation event)
  - [ ] "View Consolidated Code →" button (after approval or anytime)
  - [ ] "Export PDF" button (calls backend export endpoint)

### Testing

- [ ] **Component Tests**
  - [ ] Table renders with variable data
  - [ ] Row selection updates details panel
  - [ ] Status change updates UI immediately
  - [ ] Comments display correctly
  - [ ] Navigation buttons work

- [ ] **Integration Tests**
  - [ ] Full workflow: load session → change status → add comment → navigate
  - [ ] Store state updates correctly
  - [ ] Backend API calls are made with correct parameters
  - [ ] Multi-variable scenarios (10+, 50+ variables)

- [ ] **Regression Tests**
  - [ ] Pair Programming still works
  - [ ] Consolidated Code not affected
  - [ ] Other tabs unaffected

- [ ] **Accessibility Tests**
  - [ ] Keyboard navigation (arrow keys, Tab)
  - [ ] ARIA labels on buttons, form inputs
  - [ ] Color contrast ratios meet WCAG standards
  - [ ] Screen reader compatible

- [ ] **Manual Testing**
  - [ ] Load code review session with 10+ variables
  - [ ] Approve/reject multiple variables
  - [ ] Add comments
  - [ ] Navigate back to Pair Programming
  - [ ] Check responsive behavior on mobile/tablet

### Documentation

- [ ] **Frontend Developer Guide**
  - [ ] Document CodeReviewTab component structure
  - [ ] Document props and store integration
  - [ ] Document styling conventions
  - [ ] Add code examples

---

## Phase 5: Navigation & Soft Warning Integration (Weeks 5-6)

### Consolidated Code Tab Enhancement

- [ ] **Add Review Status Banner**
  - [ ] Check `codeReviewStatus` from store
  - [ ] If status ≠ APPROVED, show banner:
    ```
    ⚠️ Code Review in Progress
    Status: [IN_REVIEW | CHANGES_REQUESTED]
    → Complete review in the Code Review tab before finalizing
    ```
  - [ ] Banner color: warning (yellow/orange)
  - [ ] Dismiss button (optional)
  - [ ] Don't block generation

- [ ] **Add "Review Code" Button**
  - [ ] Add button to navigate to Code Review tab
  - [ ] Show if review not started or in progress
  - [ ] Uses workspace navigation event

### Navigation Integration

- [ ] **Study Switching Guard**
  - [ ] Detect study switch attempt
  - [ ] Check if code review in progress (unsaved changes)
  - [ ] Show confirmation dialog:
    ```
    Save changes before switching studies?
    [Cancel] [Discard & Switch] [Save & Switch]
    ```
  - [ ] Save logic: persist review state
  - [ ] Switch logic: load new study's review state

- [ ] **Back/Forward Navigation**
  - [ ] Code Review → Pair Programming button
    - Dispatch event: `adam-ai:navigate-workspace` with path
  - [ ] Code Review → Consolidated Code button
    - Dispatch same event or use tab navigation
  - [ ] Ensure workspace updates active tab correctly

### PDF Export Integration

- [ ] **Frontend Export Function**
  - [ ] Add button in Code Review header: "Export PDF"
  - [ ] Call backend endpoint: `GET /api/v1/code-review/session/{sessionId}/export-pdf`
  - [ ] Download PDF file with timestamp in filename
  - [ ] Show loading indicator and success message

### Testing

- [ ] **Navigation Flow Tests**
  - [ ] Pair Programming → Code Review (correct data)
  - [ ] Code Review → Pair Programming (back navigation)
  - [ ] Code Review → Consolidated Code (forward navigation)
  - [ ] Status updates reflect in all tabs

- [ ] **Study Switching Tests**
  - [ ] Switch studies with unsaved review
  - [ ] Confirmation dialog appears
  - [ ] "Discard & Switch" clears review
  - [ ] "Save & Switch" persists review
  - [ ] New study review data loads correctly

- [ ] **Consolidated Code Banner Tests**
  - [ ] Banner shows when review not approved
  - [ ] Banner disappears when approved
  - [ ] "Review Code" button navigates correctly
  - [ ] Banner doesn't block code generation

- [ ] **PDF Export Tests**
  - [ ] PDF generated successfully
  - [ ] PDF contains all variables
  - [ ] PDF formatting readable
  - [ ] Per-variable content present
  - [ ] Download works in all browsers

---

## Phase 6: Testing, Polish & Launch Prep (Weeks 6-7)

### Comprehensive Testing

- [ ] **Functional Testing**
  - [ ] Happy path: Pair Programming → Code Review → Consolidated Code
  - [ ] Bulk operations: generate code for 20+ variables
  - [ ] Edge cases:
    - [ ] Variables without derivation
    - [ ] LLM failures (pseudo-code generation fails)
    - [ ] Very long pseudo-code (scroll, formatting)
    - [ ] Very long code snippets (scroll, syntax highlighting)
    - [ ] Empty comments, null fields
  - [ ] Multi-language: R and SAS

- [ ] **Regression Testing (Full App)**
  - [ ] Spec upload and parsing
  - [ ] Variable categorization
  - [ ] Pair Programming (existing features)
  - [ ] Consolidated Code generation (existing features)
  - [ ] Submission Dashboard
  - [ ] R/SAS execution (other tabs)
  - [ ] Study switching (existing behavior)
  - [ ] Project switching

- [ ] **Performance Testing**
  - [ ] Load test with 50+ variables in Code Review table
  - [ ] Measure UI response time (should be < 500ms for most actions)
  - [ ] Check for memory leaks (browser dev tools)
  - [ ] Verify pseudo-code generation time (should be < 5 sec per variable)

- [ ] **Browser & Device Testing**
  - [ ] Desktop: Chrome, Safari, Firefox (latest versions)
  - [ ] Tablet: iPad, Android tablet
  - [ ] Mobile: iPhone, Android phone
  - [ ] Check rendering, scrolling, touch interactions

- [ ] **Accessibility (A11y) Testing**
  - [ ] Keyboard navigation:
    - [ ] Tab through all interactive elements
    - [ ] Arrow keys in table
    - [ ] Enter to select/activate
  - [ ] Screen reader: NVDA, JAWS, VoiceOver
  - [ ] Color contrast: use Contrast Checker
  - [ ] ARIA labels on all buttons, form inputs, status badges

### Bug Fixes & Polish

- [ ] **Identify & Fix Issues**
  - [ ] Create GitHub issues for all bugs found
  - [ ] Prioritize: critical → high → medium
  - [ ] Fix and re-test
  - [ ] No regressions introduced

- [ ] **UX Polish**
  - [ ] Smooth animations (loading states, transitions)
  - [ ] Clear error messages (user-friendly, not technical)
  - [ ] Loading spinners for async operations
  - [ ] Success notifications (e.g., "Changes saved")
  - [ ] Confirmation dialogs for destructive actions
  - [ ] Tooltips for help text

- [ ] **Code Quality**
  - [ ] Remove console.logs (except errors)
  - [ ] No unused imports or variables
  - [ ] Consistent code formatting (Prettier)
  - [ ] Linting passes (ESLint)
  - [ ] TypeScript: no `any` types, proper typing

### Documentation

- [ ] **User Documentation**
  - [ ] How to use Pair Programming with pseudo-code
  - [ ] How to perform code review
  - [ ] How to approve/request changes
  - [ ] How to add comments and track feedback
  - [ ] How to export code review PDF
  - [ ] FAQ and troubleshooting

- [ ] **Developer Documentation**
  - [ ] Architecture overview (backend, frontend, store)
  - [ ] API documentation (all endpoints)
  - [ ] Database schema and migrations
  - [ ] How to extend pseudo-code generation
  - [ ] How to add new review features (v2)

- [ ] **Release Notes**
  - [ ] Summary of new features
  - [ ] Changes to existing features (deprecations)
  - [ ] Known issues (if any)
  - [ ] Migration instructions (if any)

### Deployment Preparation

- [ ] **Pre-Production Checklist**
  - [ ] All tests passing
  - [ ] No critical/high priority bugs
  - [ ] Code reviewed and approved
  - [ ] Documentation complete
  - [ ] Backup of production database taken
  - [ ] Rollback procedure documented and tested

- [ ] **Database Migration**
  - [ ] Run Alembic migrations on staging
  - [ ] Verify data integrity
  - [ ] Test rollback procedure
  - [ ] Document any data transformations

- [ ] **Staging Environment Testing**
  - [ ] Deploy to staging environment
  - [ ] Run full test suite
  - [ ] UAT with domain experts (2-3 days)
  - [ ] Get sign-off from product owner

- [ ] **Production Deployment Plan**
  - [ ] Deployment checklist
  - [ ] Rollback procedure
  - [ ] On-call support schedule
  - [ ] Monitoring alerts configured
  - [ ] Incident response plan

### Launch & Post-Launch

- [ ] **Production Deployment**
  - [ ] Deploy backend services
  - [ ] Run database migrations
  - [ ] Deploy frontend assets
  - [ ] Verify all endpoints accessible
  - [ ] No errors in logs

- [ ] **Post-Deployment Monitoring**
  - [ ] Error rates (should be < 1%)
  - [ ] API response times (should be < 2 sec)
  - [ ] User feedback (support tickets, surveys)
  - [ ] Metrics tracking (adoption, usage patterns)

- [ ] **Support & Documentation**
  - [ ] Train support team on new features
  - [ ] Create FAQ based on user questions
  - [ ] Document common issues and solutions

---

## Sign-Off Checklist

- [ ] **Backend Lead** – Pseudo-code generation quality, API correctness, database integrity
- [ ] **Frontend Lead** – UI/UX, responsiveness, accessibility, code quality
- [ ] **QA Lead** – Testing completeness, regression coverage, acceptance criteria met
- [ ] **Product Owner** – Features meet requirements, user experience acceptable
- [ ] **DevOps** – Deployment readiness, monitoring, rollback procedures
- [ ] **Domain Expert** – Pseudo-code clarity, review workflow intuitive, documentation accurate

---

**Checklist Version:** 1.0
**Status:** Ready for Execution
**Last Updated:** 2025-11-25
