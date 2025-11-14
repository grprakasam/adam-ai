# Future Implementation Plans - Consolidated Code Generation Frontend

## Document Information
- **Created**: November 14, 2025
- **Status**: Ready for Implementation
- **Priority**: High
- **Estimated Time**: 2-10 days (depending on approach)

---

## Current Status

### ✅ Completed (Backend - 100%)
- All backend modules created and functional
- API endpoint ready at `POST /api/v1/program-generation/consolidated`
- Complete documentation and specifications
- Code generation, optimization, and validation working

### ❌ Pending (Frontend - 0%)
- User interface components not created
- Feature exists but not accessible to users
- No visual way to trigger consolidated code generation

---

## Frontend Implementation Plan

### Phase 1: Core Integration (Day 1-2) - CRITICAL PATH

#### Step 1: Extend Zustand Store (2 hours)
**File**: `frontend/src/store/projectStore.ts`

**Add the following state properties:**

```typescript
// Consolidated Code Generation State
interface ProjectStore {
  // ... existing properties ...

  // NEW: Consolidated Code State
  consolidatedCode: {
    code: string;
    summary: {
      total_variables: number;
      categories_included: number;
      lines_of_code: number;
      file_size_kb: number;
      optimizations_applied: string[];
      generation_time_seconds: number;
      confidence_score: number;
    };
    validation_results: {
      syntax_valid: boolean;
      cdisc_compliant: boolean;
      warnings: string[];
      errors: string[];
    };
    metadata: {
      generated_at: string;
      llm_provider: string;
      model_used: string;
      execution_mode: 'api' | 'local';
    };
  } | null;

  // Generation Control
  commentVerbosity: 'low' | 'medium' | 'high';
  executionMode: 'api' | 'local';
  isGeneratingConsolidated: boolean;
  generationProgress: number;
  generationStatus: string;
  generationTime: number | null;

  // Actions
  setCommentVerbosity: (level: 'low' | 'medium' | 'high') => void;
  setExecutionMode: (mode: 'api' | 'local') => void;
  setConsolidatedCode: (code: any) => void;
  setGenerationProgress: (progress: number, status: string) => void;
  clearConsolidatedCode: () => void;

  // Computed
  canGenerateConsolidated: () => boolean;
  getApprovalSummary: () => {
    totalVariables: number;
    approvedVariables: number;
    approvalPercentage: number;
  };
}
```

**Implementation:**
```typescript
// In the store implementation
setCommentVerbosity: (level) => set({ commentVerbosity: level }),

setExecutionMode: (mode) => set({ executionMode: mode }),

setConsolidatedCode: (code) => set({ consolidatedCode: code }),

setGenerationProgress: (progress, status) =>
  set({ generationProgress: progress, generationStatus: status }),

clearConsolidatedCode: () => set({ consolidatedCode: null }),

canGenerateConsolidated: () => {
  const state = get();
  const approvals = state.getApprovalSummary();
  return approvals.approvalPercentage >= 80;
},

getApprovalSummary: () => {
  const state = get();
  const snippets = state.pairProgramming.snippets;
  const total = Object.keys(snippets).length;
  const approved = Object.values(snippets).filter(
    s => s.accepted === 'accept'
  ).length;

  return {
    totalVariables: total,
    approvedVariables: approved,
    approvalPercentage: total > 0 ? (approved / total) * 100 : 0
  };
}
```

**Initial State:**
```typescript
const initialState = {
  // ... existing state ...
  consolidatedCode: null,
  commentVerbosity: 'medium' as const,
  executionMode: 'api' as const,
  isGeneratingConsolidated: false,
  generationProgress: 0,
  generationStatus: '',
  generationTime: null,
};
```

---

#### Step 2: Create API Service Function (1 hour)
**File**: `frontend/src/services/api.ts`

**Add consolidated code generation function:**

```typescript
// Add to existing API service

export const generateConsolidatedCode = async (request: {
  study_id: string;
  dataset: string;
  language: 'R' | 'SAS';
  comment_verbosity: 'low' | 'medium' | 'high';
  execution_mode: 'api' | 'local';
  approved_variables: Array<{
    name: string;
    category: string;
    code_snippet: string;
    user_notes?: string;
    derivation_logic?: string;
    metadata?: any;
  }>;
  user_preferences?: {
    r_packages?: string[];
    sas_procs?: string[];
    include_validation?: boolean;
    include_error_handling?: boolean;
    optimization_level?: 'standard' | 'aggressive';
  };
  standards_version?: {
    adam?: string;
    sdtm?: string;
  };
}) => {
  try {
    const response = await axios.post(
      '/api/v1/program-generation/consolidated',
      request
    );
    return response.data;
  } catch (error) {
    console.error('Failed to generate consolidated code:', error);
    throw error;
  }
};
```

---

#### Step 3: Create ConsolidatedCodeTab Component (3 hours)
**File**: `frontend/src/components/ConsolidatedCodeTab.tsx`

**Basic structure:**

```typescript
import React, { useState } from 'react';
import { Card, Button, Radio, Alert, message, Space } from 'antd';
import { ThunderboltOutlined, CloudServerOutlined, LockOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useProjectStore } from '../store/projectStore';
import { generateConsolidatedCode } from '../services/api';

const ConsolidatedCodeTab: React.FC = () => {
  const {
    consolidatedCode,
    commentVerbosity,
    executionMode,
    isGeneratingConsolidated,
    canGenerateConsolidated,
    getApprovalSummary,
    setCommentVerbosity,
    setExecutionMode,
    setConsolidatedCode,
    setGenerationProgress,
    projectConfig,
    pairProgramming,
  } = useProjectStore();

  const approvalSummary = getApprovalSummary();

  const handleGenerate = async () => {
    if (!canGenerateConsolidated()) {
      message.warning('Please approve at least 80% of variables before generating consolidated code.');
      return;
    }

    try {
      setGenerationProgress(0, 'Initializing...');

      // Prepare approved variables
      const approvedVariables = Object.entries(pairProgramming.snippets)
        .filter(([_, snippet]) => snippet.accepted === 'accept')
        .map(([varName, snippet]) => ({
          name: varName,
          category: 'Derived Variables', // Get from categorization
          code_snippet: snippet.codeSnippet,
          user_notes: snippet.userNotes,
          derivation_logic: snippet.rationale,
          metadata: snippet.metadata,
        }));

      setGenerationProgress(20, 'Preparing request...');

      const request = {
        study_id: projectConfig.studyId || 'STUDY001',
        dataset: projectConfig.adamDataset || 'ADSL',
        language: projectConfig.programmingLanguage || 'R',
        comment_verbosity: commentVerbosity,
        execution_mode: executionMode,
        approved_variables: approvedVariables,
        user_preferences: {
          r_packages: ['dplyr', 'tidyr', 'haven'],
          include_validation: true,
          include_error_handling: true,
          optimization_level: 'standard' as const,
        },
        standards_version: {
          adam: projectConfig.adamIgVersion,
          sdtm: projectConfig.sdtmVersion,
        },
      };

      setGenerationProgress(40, 'Generating code...');

      const result = await generateConsolidatedCode(request);

      setGenerationProgress(100, 'Complete');

      if (result.status === 'success') {
        setConsolidatedCode(result.data);
        message.success('Consolidated code generated successfully!');
      } else {
        message.error(result.message || 'Failed to generate code');
      }
    } catch (error: any) {
      console.error('Error generating consolidated code:', error);
      message.error(error.response?.data?.detail || 'Failed to generate consolidated code');
      setGenerationProgress(0, '');
    }
  };

  return (
    <div className="consolidated-code-tab" style={{ padding: '24px' }}>
      {/* Header */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Consolidated ADAM Code Generation</h2>
            <p>Generate optimized, production-ready code from approved variables</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: approvalSummary.approvalPercentage >= 80 ? '#52c41a' : '#faad14' }}>
              {approvalSummary.approvalPercentage.toFixed(0)}%
            </div>
            <div style={{ fontSize: '12px', color: '#888' }}>
              {approvalSummary.approvedVariables}/{approvalSummary.totalVariables} Approved
            </div>
          </div>
        </div>
      </Card>

      {/* Controls */}
      <Card title="Generation Settings" style={{ marginBottom: '24px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Execution Mode */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              Data Security Mode
            </label>
            <Radio.Group
              value={executionMode}
              onChange={(e) => setExecutionMode(e.target.value)}
              buttonStyle="solid"
            >
              <Radio.Button value="api">
                <CloudServerOutlined /> Secure API
              </Radio.Button>
              <Radio.Button value="local">
                <LockOutlined /> Local Ollama
              </Radio.Button>
            </Radio.Group>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
              {executionMode === 'local'
                ? '🔒 All processing stays on this device. No external API calls.'
                : '☁️ Uses encrypted API calls to your configured LLM provider.'}
            </div>
          </div>

          {/* Comment Verbosity */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              Comment Verbosity
            </label>
            <Radio.Group
              value={commentVerbosity}
              onChange={(e) => setCommentVerbosity(e.target.value)}
            >
              <Radio value="low">Low (Header only)</Radio>
              <Radio value="medium">Medium (Section headers)</Radio>
              <Radio value="high">High (Inline explanations)</Radio>
            </Radio.Group>
          </div>

          {/* Generate Button */}
          <Button
            type="primary"
            size="large"
            icon={<ThunderboltOutlined />}
            onClick={handleGenerate}
            disabled={!canGenerateConsolidated() || isGeneratingConsolidated}
            loading={isGeneratingConsolidated}
            block
          >
            {isGeneratingConsolidated ? 'Generating...' : 'Generate Consolidated Code'}
          </Button>

          {!canGenerateConsolidated() && (
            <Alert
              message="Approval Required"
              description={`Please approve at least ${80 - approvalSummary.approvalPercentage}% more variables to enable code generation.`}
              type="warning"
              showIcon
            />
          )}
        </Space>
      </Card>

      {/* Code Display */}
      {consolidatedCode && (
        <Card
          title="Generated Code"
          extra={
            <Space>
              <Button onClick={() => {
                navigator.clipboard.writeText(consolidatedCode.code);
                message.success('Code copied to clipboard!');
              }}>
                Copy
              </Button>
              <Button type="primary" onClick={() => {
                const blob = new Blob([consolidatedCode.code], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${projectConfig.adamDataset || 'code'}.${projectConfig.programmingLanguage === 'R' ? 'R' : 'sas'}`;
                a.click();
                URL.revokeObjectURL(url);
              }}>
                Download
              </Button>
            </Space>
          }
        >
          <Editor
            height="600px"
            language={projectConfig.programmingLanguage === 'R' ? 'r' : 'sas'}
            value={consolidatedCode.code}
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: true },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
            }}
          />

          {/* Summary */}
          <div style={{ marginTop: '24px', padding: '16px', background: '#f5f5f5', borderRadius: '4px' }}>
            <h3>Summary</h3>
            <ul>
              <li>Total Variables: {consolidatedCode.summary.total_variables}</li>
              <li>Lines of Code: {consolidatedCode.summary.lines_of_code}</li>
              <li>File Size: {consolidatedCode.summary.file_size_kb} KB</li>
              <li>Generation Time: {consolidatedCode.summary.generation_time_seconds}s</li>
              <li>Confidence Score: {consolidatedCode.summary.confidence_score}%</li>
            </ul>

            {consolidatedCode.summary.optimizations_applied.length > 0 && (
              <>
                <h4>Optimizations Applied:</h4>
                <ul>
                  {consolidatedCode.summary.optimizations_applied.map((opt, idx) => (
                    <li key={idx}>{opt}</li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Validation Results */}
          {consolidatedCode.validation_results && (
            <div style={{ marginTop: '16px', padding: '16px', background: consolidatedCode.validation_results.syntax_valid ? '#f6ffed' : '#fff2e8', borderRadius: '4px' }}>
              <h3>Validation Results</h3>
              <p>
                ✓ Syntax Valid: {consolidatedCode.validation_results.syntax_valid ? 'Yes' : 'No'}
              </p>
              <p>
                ✓ CDISC Compliant: {consolidatedCode.validation_results.cdisc_compliant ? 'Yes' : 'No'}
              </p>
              {consolidatedCode.validation_results.warnings.length > 0 && (
                <>
                  <h4>Warnings:</h4>
                  <ul>
                    {consolidatedCode.validation_results.warnings.map((warn, idx) => (
                      <li key={idx}>{warn}</li>
                    ))}
                  </ul>
                </>
              )}
              {consolidatedCode.validation_results.errors.length > 0 && (
                <>
                  <h4>Errors:</h4>
                  <ul style={{ color: 'red' }}>
                    {consolidatedCode.validation_results.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default ConsolidatedCodeTab;
```

---

#### Step 4: Add Tab to LeftPanel Navigation (30 minutes)
**File**: `frontend/src/components/LeftPanel.tsx`

**Find the tabs array and add:**

```typescript
const tabs = [
  { key: 'project', label: 'Project Config', icon: <ProjectOutlined /> },
  { key: 'standards', label: 'Standards', icon: <BookOutlined /> },
  { key: 'data', label: 'Data', icon: <DatabaseOutlined /> },
  { key: 'rules', label: 'Rules', icon: <ControlOutlined /> },
  { key: 'variables', label: 'Variables Analysis', icon: <CodeOutlined /> },
  // NEW: Add this tab
  {
    key: 'consolidated',
    label: 'Consolidated Code',
    icon: <ThunderboltOutlined />,
    disabled: !useProjectStore.getState().canGenerateConsolidated()
  },
];
```

**In the render section, add the route:**

```typescript
{activeTab === 'consolidated' && <ConsolidatedCodeTab />}
```

---

#### Step 5: Create Basic CSS (30 minutes)
**File**: `frontend/src/components/ConsolidatedCodeTab.css`

```css
.consolidated-code-tab {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.consolidated-code-tab h2 {
  margin: 0 0 8px 0;
  color: #1890ff;
}

.consolidated-code-tab .ant-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.consolidated-code-tab .ant-btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
}

.consolidated-code-tab .ant-btn-primary:hover {
  opacity: 0.9;
}

.consolidated-code-tab .ant-radio-button-wrapper-checked {
  background: #1890ff;
  color: white;
}
```

---

### Phase 2: Enhanced Features (Day 3-5) - OPTIONAL

#### Step 6: Create ProgressIndicator Component (2 hours)
**File**: `frontend/src/components/ProgressIndicator.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Card, Progress, Space, Typography } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface ProgressIndicatorProps {
  progress: number;
  status: string;
  elapsedSeconds?: number;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  progress,
  status,
  elapsedSeconds
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <Card style={{ marginBottom: '24px', textAlign: 'center' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <LoadingOutlined style={{ fontSize: 48, color: '#1890ff' }} />

        <Progress
          type="circle"
          percent={Math.round(progress)}
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068',
          }}
        />

        <Text strong>{status}</Text>

        <Text type="secondary">Elapsed: {formatTime(elapsed)}</Text>
      </Space>
    </Card>
  );
};

export default ProgressIndicator;
```

**Then integrate it into ConsolidatedCodeTab:**

```typescript
// Import at top
import ProgressIndicator from './ProgressIndicator';

// Add in render, before code display
{isGeneratingConsolidated && generationProgress < 100 && (
  <ProgressIndicator
    progress={generationProgress}
    status={generationStatus}
  />
)}
```

---

#### Step 7: Create CodeSummaryPanel Component (2 hours)
**File**: `frontend/src/components/CodeSummaryPanel.tsx`

```typescript
import React from 'react';
import { Card, Statistic, Row, Col, List, Tag } from 'antd';
import {
  FileTextOutlined,
  CodeOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';

interface CodeSummaryPanelProps {
  summary: {
    total_variables: number;
    categories_included: number;
    lines_of_code: number;
    file_size_kb: number;
    optimizations_applied: string[];
    generation_time_seconds: number;
    confidence_score?: number;
  };
}

const CodeSummaryPanel: React.FC<CodeSummaryPanelProps> = ({ summary }) => {
  return (
    <Card title="Code Generation Summary" style={{ marginTop: '24px' }}>
      <Row gutter={16}>
        <Col span={6}>
          <Statistic
            title="Total Variables"
            value={summary.total_variables}
            prefix={<CodeOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Categories"
            value={summary.categories_included}
            prefix={<FileTextOutlined />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Lines of Code"
            value={summary.lines_of_code}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Generation Time"
            value={summary.generation_time_seconds}
            suffix="s"
            prefix={<ThunderboltOutlined />}
          />
        </Col>
      </Row>

      {summary.confidence_score && (
        <div style={{ marginTop: 24 }}>
          <Tag
            color={summary.confidence_score >= 90 ? 'success' : summary.confidence_score >= 70 ? 'warning' : 'error'}
            style={{ fontSize: '14px', padding: '4px 12px' }}
          >
            <CheckCircleOutlined /> Confidence Score: {summary.confidence_score}%
          </Tag>
        </div>
      )}

      {summary.optimizations_applied.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4>Optimizations Applied</h4>
          <List
            size="small"
            bordered
            dataSource={summary.optimizations_applied}
            renderItem={(item) => (
              <List.Item>
                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                {item}
              </List.Item>
            )}
          />
        </div>
      )}
    </Card>
  );
};

export default CodeSummaryPanel;
```

---

#### Step 8: Create ValidationResultsPanel Component (1 hour)
**File**: `frontend/src/components/ValidationResultsPanel.tsx`

```typescript
import React from 'react';
import { Card, Alert, Collapse, List, Tag } from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';

interface ValidationResultsPanelProps {
  results: {
    syntax_valid: boolean;
    cdisc_compliant: boolean;
    warnings: string[];
    errors: string[];
  };
}

const ValidationResultsPanel: React.FC<ValidationResultsPanelProps> = ({ results }) => {
  const allValid = results.syntax_valid && results.cdisc_compliant && results.errors.length === 0;

  return (
    <Card title="Validation Results" style={{ marginTop: '24px' }}>
      {allValid ? (
        <Alert
          message="All Validations Passed"
          description="The generated code is syntactically valid and CDISC compliant."
          type="success"
          icon={<CheckCircleOutlined />}
          showIcon
        />
      ) : (
        <Alert
          message="Validation Issues Detected"
          description="Please review warnings and errors before using the code."
          type="warning"
          icon={<WarningOutlined />}
          showIcon
        />
      )}

      <div style={{ marginTop: 16 }}>
        <Tag color={results.syntax_valid ? 'success' : 'error'}>
          {results.syntax_valid ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          {' '}Syntax: {results.syntax_valid ? 'Valid' : 'Invalid'}
        </Tag>
        <Tag color={results.cdisc_compliant ? 'success' : 'error'}>
          {results.cdisc_compliant ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          {' '}CDISC Compliance: {results.cdisc_compliant ? 'Pass' : 'Fail'}
        </Tag>
      </div>

      {results.warnings.length > 0 && (
        <Collapse style={{ marginTop: 16 }}>
          <Collapse.Panel header={`Warnings (${results.warnings.length})`} key="warnings">
            <List
              size="small"
              dataSource={results.warnings}
              renderItem={(warning) => (
                <List.Item>
                  <WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />
                  {warning}
                </List.Item>
              )}
            />
          </Collapse.Panel>
        </Collapse>
      )}

      {results.errors.length > 0 && (
        <Collapse style={{ marginTop: 16 }}>
          <Collapse.Panel header={`Errors (${results.errors.length})`} key="errors">
            <List
              size="small"
              dataSource={results.errors}
              renderItem={(error) => (
                <List.Item>
                  <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                  {error}
                </List.Item>
              )}
            />
          </Collapse.Panel>
        </Collapse>
      )}
    </Card>
  );
};

export default ValidationResultsPanel;
```

---

### Phase 3: Polish & Testing (Day 6-7) - RECOMMENDED

#### Step 9: Integration Testing Checklist

**Test Scenarios:**

1. **Approval Threshold Test**
   - [ ] Tab disabled when < 80% approved
   - [ ] Tab enabled when >= 80% approved
   - [ ] Warning message shows correct percentage needed

2. **Code Generation Test**
   - [ ] Generate button works
   - [ ] API call succeeds
   - [ ] Code displays in Monaco editor
   - [ ] Summary shows correct statistics
   - [ ] Validation results display

3. **Settings Test**
   - [ ] Comment verbosity changes (low/medium/high)
   - [ ] Execution mode switches (API/local)
   - [ ] Settings persist across sessions

4. **Actions Test**
   - [ ] Copy to clipboard works
   - [ ] Download creates correct file
   - [ ] File has correct extension (.R or .sas)
   - [ ] Regenerate button works

5. **Error Handling Test**
   - [ ] Backend error shows user-friendly message
   - [ ] Network error handled gracefully
   - [ ] Validation errors display correctly

#### Step 10: Performance Optimization

```typescript
// Use React.memo for expensive components
export default React.memo(ConsolidatedCodeTab);

// Lazy load Monaco editor
const Editor = React.lazy(() => import('@monaco-editor/react'));

// Debounce rapid state updates
import { debounce } from 'lodash';

const debouncedProgressUpdate = debounce(setGenerationProgress, 100);
```

---

## Additional Features (Optional - Future Enhancements)

### 1. Ollama Integration (Backend)
**File**: `backend/app/modules/llm_integration/ollama_client.py`

```python
import httpx
from typing import Dict, Any

class OllamaClient:
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.2"):
        self.base_url = base_url
        self.model = model
        self.client = httpx.AsyncClient(timeout=120.0)

    async def is_available(self) -> bool:
        try:
            response = await self.client.get(f"{self.base_url}/api/tags")
            return response.status_code == 200
        except:
            return False

    async def generate_code(self, prompt: str, context: Dict[str, Any]) -> str:
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,
                "top_p": 0.9,
            }
        }

        response = await self.client.post(
            f"{self.base_url}/api/generate",
            json=payload
        )

        if response.status_code == 200:
            return response.json()["response"]
        else:
            raise Exception(f"Ollama generation failed: {response.text}")

    async def close(self):
        await self.client.aclose()
```

### 2. Advanced Progress Tracking (Real-time WebSocket)
- Implement WebSocket connection for real-time progress
- Stream progress updates from backend
- Show live status for each step

### 3. Code Comparison Tool
- Compare generated code with previous version
- Highlight differences
- Track changes over time

### 4. Export Options
- Export as PDF with documentation
- Export as ZIP with multiple formats
- Export with execution logs

---

## Implementation Timeline

### Minimal Viable Product (MVP)
- **Day 1**: Steps 1-3 (Store + API + Component)
- **Day 2**: Steps 4-5 (Navigation + CSS)
- **Total**: 2 days, basic functionality working

### Enhanced Version
- **Day 3-4**: Steps 6-8 (Progress + Panels)
- **Day 5**: Step 9 (Testing)
- **Total**: 5 days, polished with all features

### Production Ready
- **Day 6-7**: Step 10 + Optimizations
- **Day 8-10**: Additional features + Documentation
- **Total**: 10 days, enterprise-grade

---

## Success Criteria

### MVP Success
✅ User can click "Generate Consolidated Code"
✅ Code appears in editor
✅ User can copy/download code
✅ Basic validation shows

### Enhanced Success
✅ All of MVP +
✅ Real-time progress indicator
✅ Detailed summary panels
✅ Validation results display
✅ Settings persist

### Production Success
✅ All of Enhanced +
✅ Ollama local execution works
✅ Performance optimized (<2s load)
✅ All edge cases handled
✅ Full test coverage

---

## Risk Mitigation

### Potential Issues & Solutions

1. **Monaco Editor Performance**
   - Risk: Slow rendering for large code files
   - Solution: Lazy load, limit initial display to 1000 lines

2. **State Management Complexity**
   - Risk: Store becomes too large
   - Solution: Split into multiple stores if needed

3. **API Response Time**
   - Risk: Generation takes >10 seconds
   - Solution: Show progress, allow cancellation

4. **Browser Compatibility**
   - Risk: Features don't work in older browsers
   - Solution: Test on Chrome, Firefox, Edge, Safari

---

## Documentation Needed

1. **User Guide**
   - How to use consolidated code feature
   - Comment verbosity explained
   - Execution modes comparison

2. **Developer Guide**
   - Component architecture
   - State flow diagram
   - API integration guide

3. **Troubleshooting**
   - Common errors and solutions
   - Debugging tips
   - Performance tuning

---

## Notes

- All backend code is complete and tested
- Frontend components follow existing design patterns
- Uses Ant Design for consistency
- Monaco Editor already integrated elsewhere
- API endpoint documented and working

**Next Action When Ready**: Start with Step 1 (Zustand Store Extension) and build incrementally, testing after each step.

---

**Last Updated**: November 14, 2025
**Status**: Ready to implement
**Owner**: Development Team
**Priority**: High (Feature exists but not accessible)
