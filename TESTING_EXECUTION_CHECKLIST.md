# ADAM AI Testing - Execution Checklist
**Quick Start Guide for Implementation**

---

## Pre-Implementation Setup (Do This First)

### Step 1: Review Documents ✅
- [ ] Read `TESTING_IMPLEMENTATION_SUMMARY.md` (10 min)
- [ ] Skim `E2E_TESTING_AND_QA_PLAN.md` Part 1-2 (20 min)
- [ ] Review `COMPREHENSIVE_STATUS_AND_FIX_PLAN.md` (15 min)

### Step 2: Install Dependencies

**Backend**:
```bash
cd backend
..\prakenv\Scripts\python.exe -m pip install pytest-cov pytest-mock
# Verify faker already installed: faker==33.1.0
```

**Frontend**:
```bash
cd frontend
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
npm install --save-dev @testing-library/user-event jsdom
```

### Step 3: Verify Current State

```bash
# Backend tests
cd backend
pytest tests/ -v  # Should see ~11 test files, most passing

# Frontend (should fail - no tests exist yet)
cd frontend
npm run test:unit  # Should show 0 tests
```

---

## Phase 1: UX Improvements (0.5 Days)

### Task 1.1: Add Consolidated Code Navigation (1 hour)

**File**: `frontend/src/components/VariablesAnalysisTab.tsx`

**Change Required**: Add alert after bulk generation

```typescript
// FIND THIS SECTION (around line 200-250):
{bulkGenerationComplete && (
  // ... existing code ...
)}

// ADD THIS AFTER IT:
{bulkGenerationComplete && approvedCount >= totalCount * 0.8 && (
  <Alert
    message="Ready for Consolidated Code"
    type="success"
    showIcon
    description={
      <Space direction="vertical">
        <Text>You have {approvedCount}/{totalCount} variables approved ({Math.round(approvedCount/totalCount*100)}%)</Text>
        <Button type="primary" onClick={() => onNavigateToConsolidated?.()}>
          Generate Consolidated Code →
        </Button>
      </Space>
    }
    style={{ marginTop: 16 }}
  />
)}
```

**File**: `frontend/src/components/RightPanel.tsx`

**Change Required**: Pass navigation handler

```typescript
// FIND:
<VariablesAnalysisTab {...props} />

// CHANGE TO:
<VariablesAnalysisTab
  {...props}
  onNavigateToConsolidated={() => setActiveTab('consolidated')}
/>
```

**Test**:
- [ ] Navigate to Variables Analysis tab
- [ ] Approve 80%+ of variables
- [ ] Alert appears with button
- [ ] Click button → navigates to Consolidated Code tab

### Task 1.2: Add Submission Readiness Navigation (2 hours)

**File**: `frontend/src/components/RightPanel.tsx`

**Change Required**: Update tab list and add submission tab

```typescript
// FIND the tabs array:
const tabs = [
  { key: 'project', label: '📋 Project Configuration' },
  { key: 'data', label: '📁 Data Upload' },
  // ... more tabs ...
];

// UPDATE TO ADD SUBMISSION TAB:
const tabs = [
  { key: 'project', label: '📋 Project Configuration', disabled: false },
  { key: 'data', label: '📁 Data Upload', disabled: !projectConfig.studyId },
  { key: 'variables', label: '🔬 Variables', disabled: !specificationFile },
  { key: 'validation', label: '✅ My Validation', disabled: !codeSnippets.length },
  { key: 'consolidated', label: '📝 Consolidated Code', disabled: !isVariablesApproved },
  { key: 'traceability', label: '🔗 Traceability', disabled: !codeSnippets.length },
  { key: 'submission', label: '📦 Submission', disabled: !codeSnippets.length },  // NEW
  { key: 'test', label: '🧪 Test With Data', disabled: false },
];
```

**File**: `frontend/src/components/SubmissionReadinessTab.tsx`

**Check**: Does this file exist? If not, create it with basic content:

```typescript
import React from 'react';
import { Card, Alert, Button, Statistic, Row, Col } from 'antd';
import { useProjectStore } from '../store/projectStore';

const SubmissionReadinessTab: React.FC = () => {
  const store = useProjectStore();

  return (
    <Card title="FDA Submission Readiness">
      <Alert
        message="Submission Features - Coming Soon"
        description="This tab will help you validate submission readiness and generate FDA-compliant packages."
        type="info"
        showIcon
      />
      <Row style={{ marginTop: 20 }}>
        <Col span={8}>
          <Statistic title="Readiness Score" value={65} suffix="%" />
        </Col>
      </Row>
    </Card>
  );
};

export default SubmissionReadinessTab;
```

**Test**:
- [ ] Submission tab appears in navigation
- [ ] Tab is disabled until 80%+ approval
- [ ] Tab loads without errors
- [ ] Badge shows readiness score

### Task 1.3: Add Tab Tooltips (1 hour)

**File**: `frontend/src/components/RightPanel.tsx`

**Change Required**: Add tooltips to tabs

```typescript
import { Tooltip } from 'antd';

const TAB_TOOLTIPS = {
  project: 'Configure study metadata and CDISC standards',
  data: 'Upload your ADAM specification file',
  variables: 'Review variables and generate code snippets',
  validation: 'Approve code snippets before consolidation (need 80%+)',
  consolidated: 'Assemble approved snippets into complete program',
  traceability: 'View SDTM→Transform→ADAM data lineage',
  submission: 'Validate submission readiness and generate FDA packages',
  test: 'Generate mock SDTM data for testing your code',
};

// In tab header:
<Tooltip title={TAB_TOOLTIPS[activeTab]}>
  <InfoCircleOutlined style={{ marginLeft: 8, cursor: 'help' }} />
</Tooltip>
```

**Test**:
- [ ] Hover over info icon
- [ ] Tooltip appears for each tab
- [ ] Text is clear and helpful

---

## Phase 2: Backend Unit Tests (2 Days)

### Task 2.1: Program Generation Tests (4 hours)

**Create files**:
1. `backend/tests/test_program_generation/__init__.py` (empty)
2. `backend/tests/test_program_generation/test_models.py`

```python
# test_models.py
import pytest
from app.modules.program_generation.models import (
    ApprovedVariable,
    ConsolidatedCodeRequest
)

def test_approved_variable_validation():
    """Test ApprovedVariable model validation"""
    var = ApprovedVariable(
        name="USUBJID",
        category="Subject & Study Identifiers",
        code="data$USUBJID <- paste0(data$STUDYID, data$SUBJID)",
        approved=True
    )
    assert var.name == "USUBJID"
    assert var.approved is True

def test_consolidated_code_request_validation():
    """Test ConsolidatedCodeRequest validation"""
    request = ConsolidatedCodeRequest(
        study_id="STUDY001",
        dataset="ADSL",
        language="R",
        approved_variables=[
            ApprovedVariable(
                name="USUBJID",
                category="Identifiers",
                code="code",
                approved=True
            )
        ]
    )
    assert request.study_id == "STUDY001"
    assert len(request.approved_variables) == 1
```

3. `backend/tests/test_program_generation/test_validators.py` (similar pattern)
4. `backend/tests/test_program_generation/test_assembler.py`
5. `backend/tests/test_program_generation/test_optimizer.py`
6. `backend/tests/test_program_generation/test_service.py`

**Test Commands**:
```bash
cd backend
pytest tests/test_program_generation/ -v --cov=app.modules.program_generation
```

**Expected**: All tests passing, >80% coverage

### Task 2.2: Traceability Tests (2 hours)

**Create files**:
1. `backend/tests/test_traceability/__init__.py`
2. `backend/tests/test_traceability/test_spec_parser.py`
3. `backend/tests/test_traceability/test_code_inspector.py`
4. `backend/tests/test_traceability/test_graph_builder.py`
5. `backend/tests/test_traceability/test_ai_analyzer.py`

**Same pattern as 2.1** - create test files with basic test cases

**Test Commands**:
```bash
cd backend
pytest tests/test_traceability/ -v --cov=app.modules.traceability
```

### Task 2.3: Submission Tests (2 hours)

**Create files**:
1. `backend/tests/test_submission/__init__.py`
2. `backend/tests/test_submission/test_validation.py`
3. `backend/tests/test_submission/test_generation.py`
4. `backend/tests/test_submission/test_packaging.py`

**Same pattern** - test each module's core functionality

**Test Commands**:
```bash
cd backend
pytest tests/test_submission/ -v --cov=app.modules.submission
```

### Task 2.4: Test Data Tests (1 hour)

**Create files**:
1. `backend/tests/test_data_generation/__init__.py`
2. `backend/tests/test_data_generation/test_sdtm_generator.py`

```python
# test_sdtm_generator.py
import pytest
from app.modules.test_data_generation.sdtm_generator import SDTMGenerator

def test_dm_generation():
    """Test Demographics (DM) dataset generation"""
    generator = SDTMGenerator()
    dm = generator.generate_dm(n_subjects=10)

    assert len(dm) == 10
    assert 'STUDYID' in dm.columns
    assert 'SUBJID' in dm.columns
    assert all(dm['STUDYID'] == 'STUDY001')

def test_ae_generation():
    """Test Adverse Events (AE) generation"""
    generator = SDTMGenerator()
    ae = generator.generate_ae(n_subjects=5, records_per_subject=2)

    assert len(ae) == 10  # 5 subjects * 2 records
    assert 'AEDECOD' in ae.columns
    assert 'AESEV' in ae.columns
```

**Test Commands**:
```bash
cd backend
pytest tests/test_data_generation/ -v --cov=app.modules.test_data_generation
```

### Task 2.5: Integration Tests (2 hours)

**Create files**:
1. `backend/tests/test_integration/test_workflows.py`
2. `backend/tests/test_integration/test_api_contracts.py`

```python
# test_workflows.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_specification_to_code_workflow():
    """Test complete workflow: upload → categorize → generate code"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # 1. Upload specification
        # 2. Get categories
        # 3. Generate code
        # 4. Verify results
        pass

@pytest.mark.asyncio
async def test_api_endpoint_exists():
    """Verify all API endpoints exist and respond"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        endpoints = [
            "/api/v1/health",
            "/api/v1/specification/upload",
            "/api/v1/code-generation/generate-code-bulk",
            # ... more endpoints
        ]

        for endpoint in endpoints:
            response = await client.get(endpoint)
            assert response.status_code != 404, f"Endpoint {endpoint} not found"
```

---

## Phase 3: Frontend Unit Tests (2 Days)

### Task 3.1: Setup Frontend Testing

**Step 1**: Create Vitest config

**File**: `frontend/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**File**: `frontend/tests/setup.ts`

```typescript
import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  }),
});
```

**Step 2**: Update `package.json` scripts

```json
{
  "scripts": {
    "test:unit": "vitest",
    "test:unit:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch"
  }
}
```

### Task 3.2: Component Tests (8 hours)

**Create**: `frontend/tests/components/VariablesAnalysisTab.test.tsx`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VariablesAnalysisTab from '../../src/components/VariablesAnalysisTab';

describe('VariablesAnalysisTab', () => {
  beforeEach(() => {
    // Setup mock data
  });

  it('displays categorized variables', () => {
    render(<VariablesAnalysisTab />);
    expect(screen.getByText('Subject & Study Identifiers')).toBeInTheDocument();
  });

  it('calls onNavigateToConsolidated when alert button clicked', () => {
    const onNavigate = vi.fn();
    render(<VariablesAnalysisTab onNavigateToConsolidated={onNavigate} />);

    const button = screen.getByText('Generate Consolidated Code →');
    fireEvent.click(button);

    expect(onNavigate).toHaveBeenCalled();
  });
});
```

**Create similar tests for**:
- LandingPage.test.tsx
- ProjectsPage.test.tsx
- MyValidationTab.test.tsx
- ConsolidatedCodeTab.test.tsx
- TraceabilityTab.test.tsx
- TestWithDataPanel.test.tsx
- Plus: 12 more component tests

**Test Commands**:
```bash
cd frontend
npm run test:unit
npm run test:coverage
```

### Task 3.3: State Management Tests (2 hours)

**Create**: `frontend/tests/store/projectStore.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../../src/store/projectStore';

describe('projectStore', () => {
  beforeEach(() => {
    // Reset store to initial state
  });

  it('initializes with correct defaults', () => {
    const state = useProjectStore.getState();
    expect(state.projectConfig).toBeDefined();
    expect(state.getCompletionPercentage()).toBe(0);
  });

  it('updates project config', () => {
    const store = useProjectStore.getState();
    store.setProjectConfig({
      studyId: 'STUDY001',
      // ... more fields
    });

    expect(store.projectConfig.studyId).toBe('STUDY001');
  });

  it('calculates completion percentage correctly', () => {
    const store = useProjectStore.getState();
    // Set partial data
    store.setProjectConfig({ studyId: 'STUDY001' });

    const completion = store.getCompletionPercentage();
    expect(completion).toBeGreaterThan(0);
    expect(completion).toBeLessThanOrEqual(100);
  });
});
```

---

## Phase 4: E2E Tests (1 Day)

### Task 4.1: Setup Playwright

```bash
cd frontend
npm install --save-dev @playwright/test

# Create test directory
mkdir -p e2e
```

### Task 4.2: Create E2E Tests

**File**: `frontend/e2e/flow_complete_generation.spec.ts`

```typescript
import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Complete ADAM Program Generation Flow', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    await page.goto(BASE_URL);
  });

  test('user can generate complete ADAM program', async () => {
    // 1. Project Configuration
    await page.fill('input[name="study_id"]', 'STUDY001');
    await page.fill('input[name="protocol"]', 'PROT-2025-001');

    // 2. Data Upload
    await page.click('text=Data Upload');
    await page.setInputFiles('input[type="file"]', 'tests/fixtures/ADSL_Spec.xlsx');

    // 3. Variables Analysis
    await page.click('text=Variables');
    await page.click('button:has-text("Get AI Inputs")');
    await page.waitForTimeout(30000);  // Wait for generation

    // 4. Approve Variables
    const approveButtons = await page.locator('button:has-text("Approve")');
    const count = await approveButtons.count();
    for (let i = 0; i < Math.ceil(count * 0.8); i++) {
      await approveButtons.nth(i).click();
    }

    // 5. Generate Consolidated Code
    await page.click('text=Consolidated Code');
    await page.click('button:has-text("Generate ADAM Program")');

    // 6. Verify Code Generated
    await expect(page.locator('[class*="monaco-editor"]')).toBeVisible();

    // 7. Download Code
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Download")');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.R$/);
  });
});
```

**File**: `frontend/e2e/flow_test_data.spec.ts`

```typescript
test('user can generate test SDTM data', async ({ page }) => {
  await page.goto(BASE_URL);

  await page.click('text=Test With Data');
  await page.selectOption('select[name="domain"]', 'DM');
  await page.fill('input[name="n_subjects"]', '50');
  await page.click('button:has-text("Generate Test Data")');

  await expect(page.locator('text=Data generated')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.click('button:has-text("Download CSV")');
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('DM.csv');
});
```

**File**: `frontend/e2e/flow_traceability.spec.ts` (similar pattern)

### Task 4.3: Run E2E Tests

```bash
cd frontend
npm run test:e2e  # Or use Playwright CLI

# With UI
npm run test:e2e -- --ui

# Generate report
npm run test:e2e -- --reporter=html
```

---

## Phase 5: Final Verification

### Task 5.1: Run Complete Test Suite

```bash
# Backend
cd backend
pytest tests/ -v --cov=app --cov-report=html

# Frontend
cd frontend
npm run test:unit -- --coverage

# E2E
npm run test:e2e
```

### Task 5.2: Coverage Reports

Check coverage:
```bash
# Backend: open backend/htmlcov/index.html
# Frontend: open frontend/coverage/lcov-report/index.html
```

**Target**:
- Backend: > 85%
- Frontend: > 70%

### Task 5.3: Fix Failing Tests

For each failing test:
1. Read the error message
2. Check the test code
3. Fix the code or test
4. Re-run

### Task 5.4: Documentation

Update documentation:
- [ ] Test README (how to run tests)
- [ ] API documentation (if changed)
- [ ] User guide (if UX changed)
- [ ] Release notes

---

## Daily Checklist

### Day 1: UX & Setup
- [ ] Phase 1 Tasks 1.1-1.3 complete
- [ ] Test dependencies installed
- [ ] Verified current test state
- [ ] All UX tests passing

### Day 2-3: Backend Tests
- [ ] Phase 2 Tasks 2.1-2.5 complete
- [ ] Backend coverage > 80%
- [ ] All backend tests passing
- [ ] Integration tests working

### Day 4-5: Frontend Tests
- [ ] Phase 3 Tasks 3.1-3.3 complete
- [ ] Frontend tests running
- [ ] Component tests created
- [ ] Frontend coverage > 60%

### Day 6: E2E & Polish
- [ ] Phase 4 complete
- [ ] E2E tests running
- [ ] Coverage reports generated
- [ ] All documentation updated
- [ ] Ready for production

---

## Troubleshooting

### Backend Tests Not Running
```bash
# Verify pytest installed
python -m pip install pytest pytest-asyncio

# Run with more verbose output
pytest tests/ -vv -s

# Run specific test file
pytest tests/test_code_generator/ -v
```

### Frontend Tests Not Running
```bash
# Verify vitest installed
npm install vitest @testing-library/react

# Run with debug
npm run test:unit -- --reporter=verbose

# Run specific test
npm run test:unit -- VariablesAnalysisTab.test.tsx
```

### E2E Tests Failing
```bash
# Run in headed mode to see browser
npm run test:e2e -- --headed

# Debug specific test
npm run test:e2e -- flow_complete_generation.spec.ts --debug

# Check if app is running
curl http://localhost:5173  # Should return HTML
```

### Coverage Not Showing
```bash
# Backend
pytest tests/ --cov=app --cov-report=term-missing

# Frontend
npm run test:unit -- --coverage --reporter=verbose
```

---

## Success Criteria

### Code Quality
- [ ] All tests passing (100% pass rate)
- [ ] No flaky tests
- [ ] Backend coverage > 85%
- [ ] Frontend coverage > 70%
- [ ] E2E coverage > 70%

### Functionality
- [ ] Complete workflow tests pass
- [ ] API contracts verified
- [ ] Error handling tested
- [ ] Performance acceptable

### User Experience
- [ ] UX improvements implemented
- [ ] Navigation flow coherent (9/10+)
- [ ] All tooltips working
- [ ] Error messages helpful

### Documentation
- [ ] Test documentation complete
- [ ] API docs current
- [ ] User guide updated
- [ ] Coverage reports generated

---

## When You're Done

1. ✅ Review all test coverage reports
2. ✅ Run full test suite one final time
3. ✅ Fix any remaining failures
4. ✅ Update CHANGELOG.md with test improvements
5. ✅ Commit all test code to git
6. ✅ Create pull request for review
7. ✅ Merge to main branch

---

## Quick Links

- **Full Test Plan**: `E2E_TESTING_AND_QA_PLAN.md`
- **Implementation Summary**: `TESTING_IMPLEMENTATION_SUMMARY.md`
- **Status Report**: `COMPREHENSIVE_STATUS_AND_FIX_PLAN.md`
- **Feature Plan**: `Context/My_Revised_Plan.md`

---

**Good luck! You've got this! 🚀**

*If you get stuck, check the troubleshooting section or review the corresponding phase in the detailed plan.*
