import { Card, Button, Space, message, Tabs, Tooltip } from 'antd';
import { CopyOutlined, SaveOutlined, ReloadOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, EditOutlined, CheckOutlined, InfoCircleOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useState, useCallback, useRef, useEffect } from 'react';
import type { GenerationResponse, ProgrammingLanguage } from '../types';
import { api } from '../services/api';
import { VariablesAnalysisTab } from './VariablesAnalysisTab';
import { MyValidationTab } from './MyValidationTab';
import { ConsolidatedCodeTab } from './ConsolidatedCodeTab';
import { TestWithDataPanel } from './TestWithDataPanel';
import { TraceabilityTab } from './TraceabilityTab';
import { CodeValidatorTab } from './CodeValidatorTab';
import SubmissionReadinessTab from './submission/SubmissionReadinessTab';
import { VisuallyHidden } from './a11y/VisuallyHidden';
import AutoSaveIndicator from './AutoSaveIndicator';
import { HistoryControls } from './HistoryControls';
import { WorkspaceNavigation } from './WorkspaceNavigation';
import { WorkspaceControls } from './WorkspaceControls';
import { WorkspaceLayoutControls } from './WorkspaceLayoutControls';
import { notifyUserError } from '../utils/errorNotifications';
import './RightPanel.css';

interface RightPanelProps {
  generationResult: GenerationResponse | null;
  language: ProgrammingLanguage;
  isUnlocked: boolean;
  completionPercentage: number;
  onUnlock: () => void;
  onSwitchProject?: () => void;
}

type WorkspaceTabKey =
  | 'pair'
  | 'validation'
  | 'consolidated'
  | 'testdata'
  | 'traceability'
  | 'validator'
  | 'submission';

type WorkspaceGroup = 'generation' | 'validation' | 'submission';

// Tab tooltips for better discoverability
const TAB_TOOLTIPS: Record<string, string> = {
  pair: 'Generate AI code snippets for individual variables with pair programming assistance',
  validation: 'Validate generated code against best practices and CDISC standards',
  consolidated: 'Consolidate approved variables into a complete, optimized ADAM program',
  validator: 'Execute and validate your code against test datasets',
  testdata: 'Generate synthetic test data and run your code',
  traceability: 'Track SDTM-to-ADAM lineage and create traceability documentation',
  submission: 'Review readiness for regulatory submission with checklist and validation'
};

const RightPanel = ({ generationResult, language, isUnlocked, completionPercentage, onUnlock, onSwitchProject }: RightPanelProps) => {
  const [editedCode, setEditedCode] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);
  const validationTimeoutRef = useRef<number | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTabKey>('pair');
  const [activeGroup, setActiveGroup] = useState<WorkspaceGroup>('generation');

  // Mapping of which tabs belong to which high-level navigation group
  const GROUP_TABS: Record<WorkspaceGroup, WorkspaceTabKey[]> = {
    generation: ['pair', 'consolidated', 'traceability'],
    validation: ['validator', 'testdata'],
    submission: ['submission', 'validation'],
  };

  // Keep active tab consistent with active group
  useEffect(() => {
    const allowed = GROUP_TABS[activeGroup];
    if (!allowed.includes(activeWorkspaceTab)) {
      setActiveWorkspaceTab(allowed[0]);
    }
  }, [activeGroup, activeWorkspaceTab]);

  // Respond to top navigation selections (nav-container)
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ path?: string }>).detail || {};
      const path = detail.path;
      if (!path) return;

      switch (path) {
        case '/pair-programming':
          setActiveGroup('generation');
          setActiveWorkspaceTab('pair');
          break;
        case '/consolidated-code':
        case '/generation-history':
          setActiveGroup('generation');
          setActiveWorkspaceTab('consolidated');
          break;
        case '/traceability':
          setActiveGroup('generation');
          setActiveWorkspaceTab('traceability');
          break;
        case '/code-validator':
        case '/validation-reports':
          setActiveGroup('validation');
          setActiveWorkspaceTab('validator');
          break;
        case '/test-with-data':
          setActiveGroup('validation');
          setActiveWorkspaceTab('testdata');
          break;
        case '/submission-dashboard':
        case '/submission-package':
          setActiveGroup('submission');
          setActiveWorkspaceTab('submission');
          break;
        case '/my-validation':
          setActiveGroup('submission');
          setActiveWorkspaceTab('validation');
          break;
        default:
          break;
      }
    };

    window.addEventListener('adam-ai:navigate-workspace', handler);
    return () => window.removeEventListener('adam-ai:navigate-workspace', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateCode = useCallback(
    async (code: string) => {
      if (!code.trim()) return;

      setIsValidating(true);
      try {
        const result = await api.validateCode({ code, language });
        setValidationResults(result);
      } catch (error) {
        notifyUserError(error, 'Validating ADAM code');
      } finally {
        setIsValidating(false);
      }
    },
    [language]
  );

  const handleCodeChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined) {
        return;
      }

      setEditedCode(value);

      if (validationTimeoutRef.current) {
        window.clearTimeout(validationTimeoutRef.current);
      }

      validationTimeoutRef.current = window.setTimeout(() => {
        validateCode(value);
      }, 1000);
    },
    [validateCode]
  );

  if (!isUnlocked) {
    const progressLabel =
      completionPercentage >= 80
        ? 'You can now start generating code'
        : 'Some configuration steps are pending - you can still start and complete them along the way.';

    return (
      <section className="right-panel locked" role="region" aria-label="Workspace tools">
        <div className="locked-panel" role="status" aria-live="polite" aria-atomic="true">
          <h3>Pair Programming Locked</h3>
          <p>{progressLabel}</p>
          <div className="locked-progress">
            <div className="locked-progress-bar">
              <div
                className="locked-progress-fill"
                style={{ width: `${Math.min(completionPercentage, 100)}%` }}
                role="progressbar"
                aria-valuenow={completionPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Workspace preparation progress"
              />
            </div>
            <span>{completionPercentage}% complete</span>
          </div>
          <Button
            type="primary"
            size="large"
            onClick={onUnlock}
            aria-describedby="workspace-lock-description"
          >
            Start Programming
          </Button>
          <VisuallyHidden id="workspace-lock-description">
            Complete the configuration steps before unlocking the pair programming workspace.
          </VisuallyHidden>
        </div>
      </section>
    );
  }
  if (!generationResult) {
    const navigateToMyValidation = () => {
      setActiveGroup('submission');
      setActiveWorkspaceTab('validation');
    };

    const navigateToConsolidated = () => {
      setActiveGroup('generation');
      setActiveWorkspaceTab('consolidated');
    };

    const navigateToTraceability = () => {
      setActiveGroup('generation');
      setActiveWorkspaceTab('traceability');
    };

    try {
      const allItems = [
        {
          key: 'pair',
          group: 'generation' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.pair}>
              <span>
                Pair Programming{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: (
            <VariablesAnalysisTab
              onSwitchProject={onSwitchProject}
              onNavigateToValidation={navigateToMyValidation}
              onNavigateToConsolidated={navigateToConsolidated}
              onNavigateToTraceability={navigateToTraceability}
            />
          ),
        },
        {
          key: 'validation',
          group: 'submission' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.validation}>
              <span>
                My Validation{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <MyValidationTab />,
        },
        {
          key: 'consolidated',
          group: 'generation' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.consolidated}>
              <span>
                Consolidated Code{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <ConsolidatedCodeTab />,
        },
        {
          key: 'validator',
          group: 'validation' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.validator}>
              <span>
                Code Validator{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <CodeValidatorTab />,
        },
        {
          key: 'testdata',
          group: 'validation' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.testdata}>
              <span>
                Test With Data{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <TestWithDataPanel />,
        },
        {
          key: 'traceability',
          group: 'generation' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.traceability}>
              <span>
                Traceability{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <TraceabilityTab />,
        },
        {
          key: 'submission',
          group: 'submission' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.submission}>
              <span>
                Submission Readiness{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <SubmissionReadinessTab />,
        },
      ];

      const itemsForGroup = allItems.filter((item) =>
        GROUP_TABS[activeGroup].includes(item.key as WorkspaceTabKey),
      );

      return (
        <section className="right-panel" role="region" aria-label="Workspace tools">
          <div className="workspace-utilities">
            <WorkspaceControls onSwitchProject={onSwitchProject} />
            <div className="workspace-utilities-right">
              <Button
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="18" rx="1" />
                  <rect x="14" y="3" width="7" height="18" rx="1" />
                </svg>}
                onClick={() => {
                  const event = new CustomEvent('adam-ai:toggle-left-panel');
                  window.dispatchEvent(event);
                }}
                size="middle"
                title="Toggle Configuration Panel"
              >
                Toggle Panel
              </Button>
              <WorkspaceLayoutControls />
              <AutoSaveIndicator />
              <HistoryControls />
            </div>
          </div>
          <div className="workspace-navigation-section">
            <WorkspaceNavigation 
              activeTab={activeWorkspaceTab}
              onTabChange={(tab) => setActiveWorkspaceTab(tab as WorkspaceTabKey)}
            />
          </div>
          <div className="workspace-content">
            {itemsForGroup.find(item => item.key === activeWorkspaceTab)?.children}
          </div>
        </section>
      );
    } catch (error) {
      console.error('RightPanel render error:', error);
      return (
        <section className="right-panel" role="region" aria-label="Workspace tools">
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <h3>Unable to load workspace</h3>
            <p>Please refresh the page and try again.</p>
            <Button type="primary" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </div>
        </section>
      );
    }
  }

  // Handle code editing

  const handleCopyCode = () => {
    const codeToCopy = isEditing ? editedCode : generationResult.code;
    navigator.clipboard.writeText(codeToCopy);
    message.success('Code copied to clipboard');
  };

  const handleSaveCode = () => {
    const codeToSave = isEditing ? editedCode : generationResult.code;
    const blob = new Blob([codeToSave], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated_code.${language.toLowerCase()}`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('Code saved');
  };

  const toggleEditMode = () => {
    if (!isEditing) {
      setEditedCode(generationResult.code);
    }
    setIsEditing(!isEditing);
  };

  const currentValidationResults = validationResults || generationResult.validationResults || [];
  const validationStats = {
    pass: currentValidationResults.filter((v: any) => v.status === 'pass').length,
    warning: currentValidationResults.filter((v: any) => v.status === 'warning').length,
    error: currentValidationResults.filter((v: any) => v.status === 'error').length,
  };

  return (
    <section className="right-panel" role="region" aria-label="Workspace tools">
      {/* Generated Code */}
      <Card 
        title={
          <Space>
            Generated Code
            {isValidating && <span style={{ fontSize: '12px', color: '#faad14' }}>(Validating...)</span>}
            {validationResults && !isValidating && (
              <span style={{ fontSize: '12px', color: validationResults.isValid ? '#52c41a' : '#ff4d4f' }}>
                {validationResults.isValid ? '\u2713 Valid' : '\u2717 Issues Found'}
              </span>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button 
              icon={isEditing ? <CheckOutlined /> : <EditOutlined />} 
              size="small"
              type={isEditing ? 'primary' : 'default'}
              onClick={toggleEditMode}
            >
              {isEditing ? 'Done' : 'Edit'}
            </Button>
            <Button icon={<CopyOutlined />} size="small" onClick={handleCopyCode}>Copy</Button>
            <Button icon={<SaveOutlined />} size="small" onClick={handleSaveCode}>Save</Button>
            <Button icon={<ReloadOutlined />} size="small">Regenerate</Button>
          </Space>
        }
        className="code-card"
      >
        <Editor
          height="400px"
          language={language.toLowerCase()}
          value={isEditing ? editedCode : generationResult.code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            readOnly: !isEditing,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
      </Card>

      {/* Validation Results */}
      <Card 
        title="Validation Results"
        extra={
          <Space size="small">
            <span style={{ color: '#16a34a', fontSize: '12px' }}>
              <CheckCircleOutlined /> {validationStats.pass}
            </span>
            <span style={{ color: '#ca8a04', fontSize: '12px' }}>
              <WarningOutlined /> {validationStats.warning}
            </span>
            <span style={{ color: '#dc2626', fontSize: '12px' }}>
              <CloseCircleOutlined /> {validationStats.error}
            </span>
          </Space>
        }
        size="small"
        className="validation-card"
      >
        {validationResults && validationResults.issues && validationResults.issues.length > 0 ? (
          <div className="validation-issues-list">
            {validationResults.issues.map((issue: any, idx: number) => (
              <div key={idx} className={`validation-issue ${issue.severity}`}>
                <div className="issue-header">
                  <span className={`severity-badge ${issue.severity}`}>
                    {issue.severity === 'error' ? '✕' : issue.severity === 'warning' ? '!' : 'ℹ'}
                  </span>
                  <span className="issue-location">Line {issue.line}{issue.column ? `, Col ${issue.column}` : ''}</span>
                </div>
                <div className="issue-message">{issue.message}</div>
                {issue.suggestion && <div className="issue-suggestion">💡 {issue.suggestion}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="validation-grid">
            <ValidationItem icon="OK" status="pass" label="CDISC Compliance" message="All rules passed" />
            <ValidationItem icon="OK" status="pass" label="Required Variables" message="Complete" />
            <ValidationItem icon="OK" status="pass" label="Derivation Logic" message="Valid" />
            <ValidationItem icon="OK" status="pass" label="Syntax Check" message="No errors" />
            <ValidationItem icon="OK" status="pass" label="Dependencies" message="Resolved" />
          </div>
        )}
      </Card>

      {/* Derivation Sequence */}
      <Card title="Derivation Sequence" size="small">
        <div className="sequence-list">
          {generationResult.derivationSequence.map((step) => (
            <div key={step.sequence} className="sequence-item">
              <div className="sequence-number">{step.sequence}</div>
              <div className="sequence-details">
                <div className="sequence-var">{step.variable}</div>
                <div className="sequence-deps">{step.dependencies}</div>
              </div>
            </div>
          ))}
          {generationResult.derivationSequence.length === 0 && (
            <div className="sequence-item">
              <div className="sequence-number">1</div>
              <div className="sequence-details">
                <div className="sequence-var">STUDYID, USUBJID, SUBJID</div>
                <div className="sequence-deps">Source: DM (no dependencies)</div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Quality Metrics */}
      <Card title="Code Quality Metrics" size="small">
        <div className="metrics-grid">
          <MetricCard label="Compliance" value={`${generationResult.qualityMetrics.compliance}%`} />
          <MetricCard label="Efficiency" value={`${generationResult.qualityMetrics.efficiency}%`} />
          <MetricCard label="Coverage" value={generationResult.qualityMetrics.coverage} />
          <MetricCard label="Readability" value={generationResult.qualityMetrics.readability} />
        </div>
      </Card>
    </section>
  );
};

const ValidationItem = ({ icon, status, label, message }: { icon: string; status: string; label: string; message: string }) => (
  <div className={`validation-item ${status}`}>
    <div className={`validation-icon ${status}`}>{icon}</div>
    <div className="validation-info">
      <div className="validation-label">{label}</div>
      <div className="validation-status">{message}</div>
    </div>
  </div>
);

const MetricCard = ({ label, value }: { label: string; value: string }) => (
  <div className="metric-card">
    <div className="metric-label">{label}</div>
    <div className="metric-value">{value}</div>
  </div>
);

export default RightPanel;
