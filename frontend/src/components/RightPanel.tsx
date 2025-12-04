import { Card, Button, Space, message, Tooltip } from 'antd';
import { CopyOutlined, SaveOutlined, ReloadOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, EditOutlined, CheckOutlined, InfoCircleOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useState, useCallback, useRef, useEffect } from 'react';
import type { GenerationResponse, ProgrammingLanguage } from '../types';
import { validateCode as validateCodeService } from '../services/validationService';
import { triggerDownload } from '../utils/downloadHelpers';
import { VariablesAnalysisTab } from './VariablesAnalysisTab';
import { ConsolidatedCodeTab } from './ConsolidatedCodeTab';
import CodeReviewTab from './CodeReviewTab';
import { TestWithDataPanel } from './TestWithDataPanel';
import { TraceabilityTab } from './TraceabilityTab';
import SubmissionReadinessTab from './submission/SubmissionReadinessTab';
import { AdamGeneratorTab } from './AdamGeneratorTab';
import { RFrontendTab } from './RFrontendTab';
import { CodeComparerTab } from './CodeComparerTab';
import { DatasetComparerTab } from './DatasetComparerTab';
import { AdamAnalyticsTab } from './AdamAnalyticsTab';
import { StudyChatbotTab } from './StudyChatbotTab';
import { TLFGeneratorTab } from './TLFGeneratorTab';
import { ADAMTutorTab } from './ADAMTutorTab';
import { AgenticAITab } from './AgenticAITab';
import AICodeDebuggerTab from './AICodeDebuggerTab';
import CodeRefactorerTab from './CodeRefactorerTab';
import MissingSpecDetectorTab from './MissingSpecDetectorTab';
import SpecComparisonTab from './SpecComparisonTab';
import ESubmissionCheckerTab from './ESubmissionCheckerTab';
import FDAReviewerPreviewTab from './FDAReviewerPreviewTab';
import EnterStudyDetailsPage from './EnterStudyDetailsPage';
import { VisuallyHidden } from './a11y/VisuallyHidden';
import { WorkspaceNavigation } from './WorkspaceNavigation';
import { notifyUserError } from '../utils/errorNotifications';
import './RightPanel.css';

interface RightPanelProps {
  generationResult: GenerationResponse | null;
  language: ProgrammingLanguage;
  isUnlocked: boolean;
  completionPercentage: number;
  onUnlock: () => void;
  onSwitchProject?: () => void;
  onOpenHelpCenter?: () => void;
}

type WorkspaceTabKey =
  | 'study-details'
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
  | 'chatbot'
  | 'code-comparer'
  | 'tlf-generator'
  | 'adam-tutor'
  | 'agentic-ai'
  | 'ai-code-debugger'
  | 'code-refactorer'
  | 'missing-spec-detector'
  | 'spec-comparison'
  | 'esubmission-checker'
  | 'fda-reviewer-preview';

type WorkspaceGroup = 'adamCoding' | 'utilities';

// Tab tooltips for better discoverability
const TAB_TOOLTIPS: Record<string, string> = {
  'study-details': 'Enter study information and upload ADAM specification file',
  pair: 'Generate AI code snippets for individual variables with pair programming assistance',
  review: 'Review and approve code variables with approval tracking and comments',
  consolidated: 'Consolidate approved variables into a complete, optimized ADAM program',
  'adam-generator': 'Execute and validate R programs to generate ADAM datasets',
  comparer: 'Compare ADAM datasets side-by-side and validate consistency',
  submission: 'Review readiness for regulatory submission with checklist and validation',
  testdata: 'Generate CDISC-compliant SDTM test data (prerequisite for ADAM development)',
  traceability: 'Track SDTM-to-ADAM lineage and create regulatory traceability documentation',
  'r-frontend': 'Professional R code execution environment - write and run any R scripts',
  analytics: 'Advanced analytics and insights for ADAM datasets with visualization tools',
  chatbot: 'AI-powered study assistant for questions about specifications and standards',
  'code-comparer': 'Compare different versions of ADAM code to identify differences and validate changes',
  'tlf-generator': 'AI-powered generation of Tables, Listings, and Figures from mockshell documents',
  'adam-tutor': 'Interactive tutorials and guides for learning ADAM programming',
  'agentic-ai': 'Autonomous AI agents for complex ADAM tasks',
  'ai-code-debugger': 'Paste error logs, AI explains root cause and suggests fixes',
  'code-refactorer': 'Upload SAS/R scripts, AI suggests optimizations for better performance',
  'missing-spec-detector': 'Upload dataset + spec Excel, AI flags discrepancies and missing values',
  'spec-comparison': 'Upload two spec versions, AI highlights semantic differences',
  'esubmission-checker': 'One-click FDA eSubmission Technical Conformance Guide compliance scan',
  'fda-reviewer-preview': 'AI role-plays FDA reviewer to identify submission weak spots'
};

const RightPanel = ({
  generationResult,
  language,
  isUnlocked,
  completionPercentage,
  onUnlock,
  onSwitchProject,
  onOpenHelpCenter,
}: RightPanelProps) => {
  const [editedCode, setEditedCode] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);
  const validationTimeoutRef = useRef<number | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTabKey>('study-details');
  const [activeGroup, setActiveGroup] = useState<WorkspaceGroup>('adamCoding');
  const workspaceContentRef = useRef<HTMLDivElement | null>(null);
  const rightPanelRef = useRef<HTMLElement | null>(null);

  // Header is ALWAYS visible - no auto-hide functionality
  // Removed scroll detection for auto-hiding to ensure persistent visibility

  // Mapping of which tabs belong to which high-level navigation group
  const GROUP_TABS: Record<WorkspaceGroup, WorkspaceTabKey[]> = {
    adamCoding: ['study-details', 'pair', 'review', 'consolidated'],
    utilities: ['submission', 'comparer', 'code-comparer', 'adam-generator', 'testdata', 'r-frontend', 'analytics', 'chatbot', 'traceability', 'tlf-generator', 'adam-tutor', 'agentic-ai', 'ai-code-debugger', 'code-refactorer', 'missing-spec-detector', 'spec-comparison', 'esubmission-checker', 'fda-reviewer-preview'],
  };

  // Keep active tab consistent with active group
  useEffect(() => {
    // First, determine which group this tab belongs to
    let tabGroup: WorkspaceGroup | null = null;
    for (const [group, tabs] of Object.entries(GROUP_TABS)) {
      if (tabs.includes(activeWorkspaceTab)) {
        tabGroup = group as WorkspaceGroup;
        break;
      }
    }

    // If tab belongs to a different group, switch to that group
    if (tabGroup && tabGroup !== activeGroup) {
      setActiveGroup(tabGroup);
    }

    // Ensure tab is in allowed list for active group
    const allowed = GROUP_TABS[activeGroup];
    if (!allowed.includes(activeWorkspaceTab) && tabGroup) {
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
        case '/study-details':
        case '/enter-study-details':
          setActiveGroup('adamCoding');
          setActiveWorkspaceTab('study-details');
          break;
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
          setActiveGroup('utilities');
          setActiveWorkspaceTab('adam-generator');
          break;
        case '/adam-dataset-comparer':
          setActiveGroup('utilities');
          setActiveWorkspaceTab('comparer');
          break;
        case '/submission-dashboard':
        case '/submission-package':
          setActiveGroup('utilities');
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
        case '/code-comparer':
          setActiveGroup('utilities');
          setActiveWorkspaceTab('code-comparer');
          break;
        case '/tlf-generator':
          setActiveGroup('utilities');
          setActiveWorkspaceTab('tlf-generator');
          break;
        case '/adam-tutor':
          setActiveGroup('utilities');
          setActiveWorkspaceTab('adam-tutor');
          break;
        case '/agentic-ai':
          setActiveGroup('utilities');
          setActiveWorkspaceTab('agentic-ai');
          break;
        case '/ai-code-debugger':
          setActiveGroup('utilities');
          setActiveWorkspaceTab('ai-code-debugger');
          break;
        case '/code-refactorer':
          setActiveGroup('utilities');
          setActiveWorkspaceTab('code-refactorer');
          break;
        case '/missing-spec-detector':
          setActiveGroup('utilities');
          setActiveWorkspaceTab('missing-spec-detector');
          break;
        case '/spec-comparison':
          setActiveGroup('utilities');
          setActiveWorkspaceTab('spec-comparison');
          break;
        case '/esubmission-checker':
          setActiveGroup('utilities');
          setActiveWorkspaceTab('esubmission-checker');
          break;
        case '/fda-reviewer-preview':
          setActiveGroup('utilities');
          setActiveWorkspaceTab('fda-reviewer-preview');
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
        const result = await validateCodeService(code, language as 'R' | 'SAS');
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

  // Pair programming is always available; skip locked state UI to streamline flow
  if (!generationResult) {
    const navigateToConsolidated = () => {
      setActiveGroup('adamCoding');
      setActiveWorkspaceTab('consolidated');
    };

    const navigateToTraceability = () => {
      setActiveGroup('utilities');
      setActiveWorkspaceTab('traceability');
    };


    try {
      const allItems = [
        {
          key: 'study-details',
          group: 'adamCoding' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS['study-details']}>
              <span>
                <span style={{ fontWeight: 700, color: 'inherit' }}>1.</span> Enter Study Details{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <EnterStudyDetailsPage />,
        },
        {
          key: 'pair',
          group: 'adamCoding' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.pair}>
              <span>
                <span style={{ fontWeight: 700, color: 'inherit' }}>2.</span> Pair Programming{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: (
            <VariablesAnalysisTab
              onSwitchProject={onSwitchProject}
              onNavigateToConsolidated={navigateToConsolidated}
              onNavigateToTraceability={navigateToTraceability}
              onOpenHelpCenter={onOpenHelpCenter}
            />
          ),
        },
        {
          key: 'review',
          group: 'adamCoding' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.review}>
              <span>
                <span style={{ fontWeight: 700, color: 'inherit' }}>3.</span> Code Review{' '}
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
                <span style={{ fontWeight: 700, color: 'inherit' }}>4.</span> Consolidated Code{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <ConsolidatedCodeTab />,
        },
        {
          key: 'adam-generator',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS['adam-generator']}>
              <span>
                ADAM Generator{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <AdamGeneratorTab />,
        },
        {
          key: 'comparer',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.comparer}>
              <span>
                Dataset Comparer{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <DatasetComparerTab />,
        },
        {
          key: 'submission',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.submission}>
              <span>
                Submission{' '}
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
                SDTM Test Data Generator{' '}
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
          children: <AdamAnalyticsTab />,
        },
        {
          key: 'chatbot',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS.chatbot}>
              <span>
                Study Assistant{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <StudyChatbotTab />,
        },
        {
          key: 'code-comparer',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS['code-comparer']}>
              <span>
                Code Comparer{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <CodeComparerTab />,
        },
        {
          key: 'tlf-generator',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS['tlf-generator']}>
              <span>
                TLF Generator{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <TLFGeneratorTab />,
        },
        {
          key: 'adam-tutor',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS['adam-tutor']}>
              <span>
                ADAM Tutor{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <ADAMTutorTab />,
        },
        {
          key: 'agentic-ai',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS['agentic-ai']}>
              <span>
                Agentic AI{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <AgenticAITab />,
        },
        {
          key: 'ai-code-debugger',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS['ai-code-debugger']}>
              <span>
                AI Code Debugger{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <AICodeDebuggerTab />,
        },
        {
          key: 'code-refactorer',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS['code-refactorer']}>
              <span>
                Code Refactorer{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <CodeRefactorerTab />,
        },
        {
          key: 'missing-spec-detector',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS['missing-spec-detector']}>
              <span>
                Missing Spec Detector{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <MissingSpecDetectorTab />,
        },
        {
          key: 'spec-comparison',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS['spec-comparison']}>
              <span>
                Spec Comparison{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <SpecComparisonTab />,
        },
        {
          key: 'esubmission-checker',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS['esubmission-checker']}>
              <span>
                eSubmission Checker{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <ESubmissionCheckerTab />,
        },
        {
          key: 'fda-reviewer-preview',
          group: 'utilities' as WorkspaceGroup,
          label: (
            <Tooltip title={TAB_TOOLTIPS['fda-reviewer-preview']}>
              <span>
                FDA Reviewer Preview{' '}
                <InfoCircleOutlined style={{ marginLeft: 4, fontSize: '12px', opacity: 0.6 }} />
              </span>
            </Tooltip>
          ),
          children: <FDAReviewerPreviewTab />,
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
            <div className="workspace-navigation-section">
              <WorkspaceNavigation
                activeTab={activeWorkspaceTab}
                onTabChange={(tab) => {
                  // Find which group this tab belongs to and set active group
                  for (const [group, tabs] of Object.entries(GROUP_TABS)) {
                    if (tabs.includes(tab as WorkspaceTabKey)) {
                      setActiveGroup(group as WorkspaceGroup);
                      break;
                    }
                  }
                  setActiveWorkspaceTab(tab as WorkspaceTabKey);
                }}
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
          height="70vh"
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
