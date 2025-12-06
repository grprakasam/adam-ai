import { Button, Typography, Tag, Card, Collapse } from 'antd';
import {
  RocketOutlined,
  CodeOutlined,
  BranchesOutlined,
  ExperimentOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  HighlightOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  ArrowRightOutlined,
  SafetyOutlined,
  FileTextOutlined,
  ToolOutlined,
  SwapOutlined,
  CheckCircleOutlined,
  ReadOutlined,
  RobotFilled,
  ThunderboltFilled,
  BugOutlined,
  FileSearchOutlined,
  DiffOutlined,
  AuditOutlined,
  UserSwitchOutlined,
  BulbOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
} from '@ant-design/icons';
import { useState, ReactNode } from 'react';
import HelpPage from './HelpPage';
import { TestWithDataPanel } from './TestWithDataPanel';
import './LandingPage.css';

const { Title, Text } = Typography;

interface LandingPageProps {
  onStartProject: () => void;
  onOpenMigration: () => void;
  onNavigateToUtility?: (path: string) => void;
  currentUser?: any;
  onLogout?: () => void;
}

interface UtilityFeature {
  key: string;
  name: string;
  path: string;
  icon: ReactNode;
  status: 'Live' | 'Preview' | 'Coming Soon';
  statusColor: string;
  actionLabel: string;
  tagline?: string;
}

interface WorkflowGroup {
  key: string;
  name: string;
  description: string;
  icon: ReactNode;
  gradient: string;
  accentColor: string;
  features: UtilityFeature[];
}

// Reorganized into 4 logical workflow groups
const workflowGroups: WorkflowGroup[] = [
  {
    key: 'core-workflow',
    name: 'SDTM ADAM TLF Programming',
    description: 'End-to-end SDTM test data, ADaM builds, and TLF generation',
    icon: <RocketOutlined />,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    accentColor: '#667eea',
    features: [
      {
        key: 'sdtm-generator',
        name: 'SDTM Test Data Generator',
        path: '/test-with-data',
        icon: <ExperimentOutlined />,
        status: 'Live',
        statusColor: 'green',
        actionLabel: 'Launch',
        tagline: 'Generate SDTM-like sample data for dry runs and testing',
      },
      {
        key: 'pair-programmer',
        name: 'ADAM AI Pair Programmer',
        path: '/workspace',
        icon: <CodeOutlined />,
        status: 'Live',
        statusColor: 'green',
        actionLabel: 'Launch',
        tagline: 'AI-assisted code generation for ADAM specifications',
      },
      {
        key: 'adam-generator',
        name: 'ADAM Generator',
        path: '/adam-generator',
        icon: <RocketOutlined />,
        status: 'Live',
        statusColor: 'green',
        actionLabel: 'Launch',
        tagline: 'Generate ADAM datasets from SDTM + code',
      },
      {
        key: 'tlf-generator',
        name: 'TLF Generator',
        path: '/tlf-generator',
        icon: <FileTextOutlined />,
        status: 'Live',
        statusColor: 'green',
        actionLabel: 'Launch',
        tagline: 'Create Tables, Listings, Figures from mockshells',
      },
      {
        key: 'traceability',
        name: 'Traceability Matrix',
        path: '/traceability',
        icon: <BranchesOutlined />,
        status: 'Live',
        statusColor: 'green',
        actionLabel: 'Launch',
        tagline: 'ADAM specification traceability to SDTM',
      },
    ],
  },
  {
    key: 'development-tools',
    name: 'Development Tools',
    description: 'Build, test, and optimize your clinical code',
    icon: <ToolOutlined />,
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    accentColor: '#f5576c',
    features: [
      {
        key: 'code-converter',
        name: 'SAS to R Migration',
        path: '/migration',
        icon: <SwapOutlined />,
        status: 'Live',
        statusColor: 'green',
        actionLabel: 'Launch',
        tagline: 'AI-powered SAS to R code migration framework',
      },
      {
        key: 'r-frontend',
        name: 'R Frontend',
        path: '/r-frontend',
        icon: <ThunderboltOutlined />,
        status: 'Live',
        statusColor: 'green',
        actionLabel: 'Launch',
        tagline: 'Execute R programs in browser',
      },
      {
        key: 'ai-code-debugger',
        name: 'AI Code Debugger',
        path: '/ai-code-debugger',
        icon: <BugOutlined />,
        status: 'Preview',
        statusColor: 'blue',
        actionLabel: 'Try Now',
        tagline: 'AI explains error logs and suggests fixes',
      },
      {
        key: 'code-refactorer',
        name: 'Code Refactorer',
        path: '/code-refactorer',
        icon: <ThunderboltFilled />,
        status: 'Preview',
        statusColor: 'blue',
        actionLabel: 'Try Now',
        tagline: 'AI suggests code optimizations',
      },
    ],
  },
  {
    key: 'quality-compliance',
    name: 'Quality & Compliance',
    description: 'Validate and prepare for submission',
    icon: <SafetyOutlined />,
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    accentColor: '#4facfe',
    features: [
      {
        key: 'submission',
        name: 'Submission Dashboard',
        path: '/submission-dashboard',
        icon: <CheckCircleOutlined />,
        status: 'Live',
        statusColor: 'green',
        actionLabel: 'Launch',
        tagline: 'AI-powered submission readiness tracking',
      },
      {
        key: 'esubmission-checker',
        name: 'eSubmission Checker',
        path: '/esubmission-checker',
        icon: <AuditOutlined />,
        status: 'Preview',
        statusColor: 'blue',
        actionLabel: 'Try Now',
        tagline: 'FDA eSubmission conformance scan',
      },
      {
        key: 'fda-reviewer-preview',
        name: 'FDA Reviewer Persona',
        path: '/fda-reviewer-preview',
        icon: <UserSwitchOutlined />,
        status: 'Preview',
        statusColor: 'blue',
        actionLabel: 'Try Now',
        tagline: 'AI simulates FDA reviewer feedback',
      },
    ],
  },
  {
    key: 'intelligence-learning',
    name: 'Intelligence & Learning',
    description: 'AI assistants and educational resources',
    icon: <BulbOutlined />,
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    accentColor: '#43e97b',
    features: [
      {
        key: 'chatbot',
        name: 'Study ChatBot',
        path: '/study-chatbot',
        icon: <RobotOutlined />,
        status: 'Preview',
        statusColor: 'blue',
        actionLabel: 'Try Now',
        tagline: 'AI answers about study documents',
      },
      {
        key: 'adam-tutor',
        name: 'ADAM Tutor',
        path: '/adam-tutor',
        icon: <ReadOutlined />,
        status: 'Preview',
        statusColor: 'blue upbeat',
        actionLabel: 'Try Now',
        tagline: 'Interactive ADAM programming tutorials',
      },
      {
        key: 'agentic-ai',
        name: 'Agentic AI',
        path: '/agentic-ai',
        icon: <RobotFilled />,
        status: 'Preview',
        statusColor: 'blue',
        actionLabel: 'Try Now',
        tagline: 'Autonomous AI agents for complex tasks',
      },
      {
        key: 'analytics',
        name: 'Role-based Analytics',
        path: '/adam-data-analytics',
        icon: <DashboardOutlined />,
        status: 'Coming Soon',
        statusColor: 'orange',
        actionLabel: 'Coming Soon',
        tagline: 'Analyze data as Statistician or Clinician',
      },
    ],
  },
  {
    key: 'utilities-ai',
    name: 'Utilities.AI',
    description: 'Quick AI helpers for comparisons and gap checks',
    icon: <ExperimentOutlined />,
    gradient: 'linear-gradient(135deg, #b5fffc 0%, #ffdee9 100%)',
    accentColor: '#8b5cf6',
    features: [
      {
        key: 'dataset-comparer',
        name: 'Dataset Comparer',
        path: '/adam-dataset-comparer',
        icon: <DeploymentUnitOutlined />,
        status: 'Preview',
        statusColor: 'blue',
        actionLabel: 'Try Now',
        tagline: 'Compare datasets and identify differences',
      },
      {
        key: 'code-comparer',
        name: 'Code Comparer',
        path: '/code-comparer',
        icon: <HighlightOutlined />,
        status: 'Preview',
        statusColor: 'blue',
        actionLabel: 'Try Now',
        tagline: 'Compare development and validation code',
      },
      {
        key: 'spec-comparison',
        name: 'Spec Comparison',
        path: '/spec-comparison',
        icon: <DiffOutlined />,
        status: 'Preview',
        statusColor: 'blue',
        actionLabel: 'Try Now',
        tagline: 'Compare specification versions semantically',
      },
      {
        key: 'missing-spec-detector',
        name: 'Spec Gap Detector',
        path: '/missing-spec-detector',
        icon: <FileSearchOutlined />,
        status: 'Preview',
        statusColor: 'blue',
        actionLabel: 'Try Now',
        tagline: 'Find discrepancies between dataset and spec',
      },
    ],
  },
];

const LandingPage = ({ onStartProject, onOpenMigration, onNavigateToUtility }: LandingPageProps) => {
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [isTestDataVisible, setIsTestDataVisible] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const handleUtilityLaunch = (path: string, key?: string) => {
    if (key === 'pair-programmer') {
      // Navigate directly to pair programming workspace
      if (onNavigateToUtility) {
        onNavigateToUtility('/pair-programming');
      }
      return;
    }

    if (key === 'sdtm-generator' && onNavigateToUtility) {
      onNavigateToUtility(path);
      return;
    }

    if (key === 'code-converter' || path === '/migration') {
      onOpenMigration();
      return;
    }

    if (onNavigateToUtility) {
      onNavigateToUtility(path);
      return;
    }
  };

  const handleGroupToggle = (keys: string | string[]) => {
    setExpandedGroups(Array.isArray(keys) ? keys : [keys]);
  };

  const allGroupKeys = workflowGroups.map(group => group.key);
  const allExpanded = expandedGroups.length === allGroupKeys.length;

  const handleToggleAll = () => {
    if (allExpanded) {
      setExpandedGroups([]);
    } else {
      setExpandedGroups(allGroupKeys);
    }
  };

  if (isTestDataVisible) {
    return (
      <div style={{ padding: '24px', background: '#f5f7fa', minHeight: '100vh' }}>
        <Button
          onClick={() => setIsTestDataVisible(false)}
          style={{ marginBottom: 16 }}
        >
          Back to landing page
        </Button>
        <TestWithDataPanel standalone={true} />
      </div>
    );
  }

  return (
    <div className="landing-page-redesign">
      {/* All Tools Section - Main Content */}
      <section className="tools-section tools-section-main">
        <div className="section-container">
          <div className="section-header">
            <Title level={2} className="section-title">
              <img src="/CompanyLogo.png" alt="Company Logo" className="company-logo" />
              Ephicacy Clinical AI Workspace
            </Title>
            <Text className="section-subtitle">
              Comprehensive suite of AI-powered tools for Clinical Programming
            </Text>
          </div>

          {/* Animated Question Section */}
          <div className="animated-question-section">
            <Text className="animated-question-text">
              Where do you want to apply AI Workspace for?
            </Text>
          </div>

          {/* Expand/Collapse All Controls */}
          <div className="expand-collapse-controls">
            <Button
              icon={allExpanded ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
              onClick={handleToggleAll}
              className="expand-collapse-btn"
            >
              {allExpanded ? 'Collapse All' : 'Expand All'}
            </Button>
          </div>

          <Collapse
            accordion={false}
            activeKey={expandedGroups}
            onChange={handleGroupToggle}
            className="workflow-collapse"
            expandIconPosition="end"
            items={workflowGroups.map((group) => ({
              key: group.key,
              label: (
                <div className="group-header">
                  <div className="group-icon-wrapper" style={{ background: group.gradient }}>
                    {group.icon}
                  </div>
                  <div className="group-info">
                    <div className="group-name">{group.name}</div>
                    <div className="group-description">{group.description}</div>
                  </div>
                  <div className="group-count">
                    <span className="count-badge">{group.features.length} tools</span>
                  </div>
                </div>
              ),
              children: (
                <div className="tools-grid">
                  {group.features.map((feature) => (
                    <Card
                      key={feature.key}
                      className="tool-card"
                      hoverable
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUtilityLaunch(feature.path, feature.key);
                      }}
                    >
                      <div className="tool-card-header">
                        <div className="tool-icon" style={{ color: group.accentColor }}>
                          {feature.icon}
                        </div>
                        <Tag color={feature.statusColor} className="tool-status">
                          {feature.status}
                        </Tag>
                      </div>
                      <Title level={5} className="tool-name">{feature.name}</Title>
                      <Text className="tool-tagline">{feature.tagline}</Text>
                      <Button
                        type="link"
                        className="tool-action"
                        style={{ color: group.accentColor }}
                      >
                        {feature.actionLabel} <ArrowRightOutlined />
                      </Button>
                    </Card>
                  ))}
                </div>
              ),
            }))}
          />
        </div>
      </section>

      <HelpPage visible={isHelpVisible} onClose={() => setIsHelpVisible(false)} />
    </div>
  );
};

export default LandingPage;
