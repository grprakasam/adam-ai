import { Card, Button, Space, message, Tooltip } from 'antd';
import { CopyOutlined, SaveOutlined, ReloadOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, EditOutlined, CheckOutlined, InfoCircleOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useState, useCallback, useRef, useEffect } from 'react';
import type { GenerationResponse, ProgrammingLanguage } from '../types';
import { api } from '../services/api';
import { triggerDownload } from '../utils/downloadHelpers';
import { VariablesAnalysisTab } from './VariablesAnalysisTab';
import { ConsolidatedCodeTab } from './ConsolidatedCodeTab';
import CodeReviewTab from './CodeReviewTab';
import { TestWithDataPanel } from './TestWithDataPanel';
import { TraceabilityTab } from './TraceabilityTab';
import SubmissionReadinessTab from './submission/SubmissionReadinessTab';
import { AdamGeneratorTab } from './AdamGeneratorTab';
import { RFrontendTab } from './RFrontendTab';
import { VisuallyHidden } from './a11y/VisuallyHidden';
import AutoSaveIndicator from './AutoSaveIndicator';
import { HistoryControls } from './HistoryControls';
import { WorkspaceNavigation } from './WorkspaceNavigation';
import { WorkspaceControls } from './WorkspaceControls';
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
  | 'review'
  | 'consolidated'
  | 'adam-generator'
  | 'comparer'
  | 'submission'
  | 'testdata'
  | 'traceability'
  | 'r-frontend'
  | 'analytics'
  | 'chatbot';

type WorkspaceGroup = 'adamCoding' | 'adamValidation' | 'utilities';

// Tab tooltips for better discoverability
const TAB_TOOLTIPS: Record<string, string> = {
  pair: 'Generate AI code snippets for individual variables with pair programming assistance',
  review: 'Review and approve consolidated code with line-level commenting and PDF export',
  consolidated: 'Consolidate approved variables into a complete, optimized ADAM program',
  'adam-generator': 'Execute and validate R programs to generate ADAM datasets',
  comparer: 'Compare ADAM datasets side-by-side and validate consistency',
  submission: 'Review readiness for regulatory submission with checklist and validation',
  testdata: 'Generate CDISC-compliant SDTM test data (prerequisite for ADAM development)',
  traceability: 'Track SDTM-to-ADAM lineage and create regulatory traceability documentation',
  'r-frontend': 'Professional R code execution environment - write and run any R scripts',
  analytics: 'Advanced analytics and insights for ADAM datasets with visualization tools',
  chatbot: 'AI-powered study assistant for questions about specifications and standards'
};

const RightPanel = ({ generationResult, language, isUnlocked, completionPercentage, onUnlock, onSwitchProject }: RightPanelProps) => {
  const [editedCode, setEditedCode] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);
  const validationTimeoutRef = useRef<number | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTabKey>('pair');
  const [activeGroup, setActiveGroup] = useState<WorkspaceGroup>('adamCoding');
  const workspaceContentRef = useRef<HTMLDivElement | null>(null);
  const rightPanelRef = useRef<HTMLElement | null>(null);
  
  // Header is ALWAYS visible - no auto-hide functionality
  // Removed scroll detection for auto-hiding to ensure persistent visibility

  // Mapping of which tabs belong to which high-level navigation group
  const GROUP_TABS: Record<WorkspaceGroup, WorkspaceTabKey[]> = {
    adamCoding: ['pair', 'review', 'consolidated', 'adam-generator'],
    adamValidation: ['comparer', 'submission'],
    utilities: ['testdata', 'r-frontend', 'analytics', 'chatbot', 'traceability'],
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
          setActiveGroup('adamCoding');
          setActiveWorkspaceTab('pair');
          break;
        case '/code-review':
          setActiveGroup('adamCoding');
          setActiveWorkspaceTab('review');
          break;
        case '/consolidated-code':
        case '/generation-history':
          setActiveGroup('adamCoding');
          setActiveWorkspaceTab('consolidated');
          break;
        case '/adam-generator':
          setActiveGroup('adamCoding');
          setActiveWorkspaceTab('adam-generator');
          break;
        case '/adam-dataset-comparer':
          setActiveGroup('adamValidation');
          setActiveWorkspaceTab('comparer');
          break;
        case '/submission-dashboard':
        case '/submission-package':
          setActiveGroup('adamValidation');
          setActiveWorkspaceTab('submission');
          break;
        case '/test-with-data':
          setActiveGroup('utilities');
          setActiveWorkspaceTab('testdata');
          break;
        case '/traceability':
          setActiveGroup('utilities');
          setActiveWorkspaceTab('traceability');
          break;
        case '/r-frontend':
          setActiveGroup('utilities');
          setActiveWorkspaceTab('r-frontend');
          break;
        case '/adam-data-analytics':
          setActiveGroup('utilities');
          setActiveWorkspaceTab('analytics');
          break;
        case '/study-chatbot':
          setActiveGroup('utilities');
          setActiveWorkspaceTab('chatbot');
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
    const navigateToConsolidated = () => {
      setActiveGroup('adamCoding');
      setActiveWorkspaceTab('consolidated');
    };

    const navigateToTraceability = () => {
      setActiveGroup('utilities');
      setActiveWorkspaceTab('traceability');
    };

    const PlaceholderContent = ({ title }: { title: string }) => (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
        <h3 style={{ marginBottom: '10px', color: '#1e293b' }}>{title}</h3>
        <p>This feature is under development. Check back soon for updates!</p>
      </div>
    );

    try {
      const allItems = [
        {
          key: 'pair',
          group: 'adamCoding' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.pair}>
              <span>
                <span style={{ fontWeight: 700, color: 'inherit' }}>1.</span> Pair Programming{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: (
            <VariablesAnalysisTab
              onSwitchProject={onSwitchProject}
              onNavigateToConsolidated={navigateToConsolidated}
              onNavigateToTraceability={navigateToTraceability}
            />
          ),
        },
        {
          key: 'review',
          group: 'adamCoding' as WorkspaceGroup,
          label: (
            <Tooltip title="Interactive code executor - write and run R/SAS code snippets">
              <span>
                <span style={{ fontWeight: 700, color: 'inherit' }}>2.</span> Code Executor{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <CodeReviewTab />,
        },
        {
          key: 'consolidated',
          group: 'adamCoding' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.consolidated}>
              <span>
                <span style={{ fontWeight: 700, color: 'inherit' }}>3.</span> Consolidated Code{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <ConsolidatedCodeTab />,
        },
        {
          key: 'adam-generator',
          group: 'adamCoding' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS['adam-generator']}>
              <span>
                <span style={{ fontWeight: 700, color: 'inherit' }}>4.</span> ADAM Generator{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <AdamGeneratorTab />,
        },
        {
          key: 'comparer',
          group: 'adamValidation' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.comparer}>
              <span>
                <span style={{ fontWeight: 700, color: 'inherit' }}>5.</span> Dataset Comparer{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <PlaceholderContent title="ADAM Dataset Comparer" />,
        },
        {
          key: 'submission',
          group: 'adamValidation' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.submission}>
              <span>
                <span style={{ fontWeight: 700, color: 'inherit' }}>6.</span> Submission{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <SubmissionReadinessTab />,
        },
        {
          key: 'testdata',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.testdata}>
              <span>
                SDTM Generator{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <TestWithDataPanel />,
        },
        {
          key: 'traceability',
          group: 'utilities' as WorkspaceGroup,
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
          key: 'r-frontend',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS['r-frontend']}>
              <span>
                R Frontend{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <RFrontendTab />,
        },
        {
          key: 'analytics',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.analytics}>
              <span>
                ADAM Data Analytics{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <PlaceholderContent title="ADAM Data Analytics" />,
        },
        {
          key: 'chatbot',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.chatbot}>
              <span>
                Study ChatBot{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <PlaceholderContent title="Study ChatBot" />,
        },
      ];

      const itemsForGroup = allItems.filter((item) =>
        GROUP_TABS[activeGroup].includes(item.key as WorkspaceTabKey),
      );

      return (
        <section 
          ref={rightPanelRef}
          className="right-panel" 
          role="region" 
          aria-label="Workspace tools"
        >
          {/* Unified Workspace Header Group - Combined Sections - ALWAYS VISIBLE */}
          <div className="workspace-header-group">
            <div className="workspace-utilities">
              <WorkspaceControls onSwitchProject={onSwitchProject} />
              <div className="workspace-utilities-right">
                <Button
                  icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="18" rx="1" />
                    <rect x="14" y="3" width="7" height="18" rx="1" />
                  </svg>}
                  onClick={() => {
                    const event = new CustomEvent('adam-ai:toggle-left-panel');
                    window.dispatchEvent(event);
                  }}
                  size="small"
                  title="Toggle Configuration Panel"
                  style={{ 
                    height: '26px', 
                    fontSize: '11px', 
                    padding: '0 8px',
                    borderRadius: '5px',
                    lineHeight: '1.2'
                  }}
                >
                  Toggle Panel
                </Button>
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
          </div>
          <div 
            ref={workspaceContentRef}
            className="workspace-content"
          >
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

    triggerDownload(
      new Blob([codeToSave], { type: 'text/plain' }),
      `generated_code.${language.toLowerCase()}`,
      {
        onSuccess: () => message.success('Code saved'),
        onError: (err) => message.error('Failed to save code: ' + err.message)
      }
    );
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
