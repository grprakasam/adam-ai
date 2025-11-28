import { Button, Typography, Tag, Card, Space } from 'antd';
import { 
  RocketOutlined, 
  CodeOutlined,
  LogoutOutlined,
  UserOutlined,
  QuestionCircleOutlined,
  BranchesOutlined,
  ExperimentOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  HighlightOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  ArrowRightOutlined,
  StarOutlined,
  SafetyOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useState, ReactNode } from 'react';
import HelpPage from './HelpPage';
import { TestWithDataPanel } from './TestWithDataPanel';
import './LandingPage.css';

const { Title, Text } = Typography;

interface LandingPageProps {
  onStartProject: () => void;
  onOpenMigration: () => void;
  currentUser?: any;
  onLogout?: () => void;
  onNavigateToUtility?: (path: string) => void;
}

interface UtilityFeature {
  key: string;
  name: string;
  path: string;
  icon: ReactNode;
  status: 'Live' | 'Preview' | 'In progress';
  statusColor: string;
  actionLabel: string;
  gradient: string;
  color: string;
}

const utilityFeatures: UtilityFeature[] = [
  {
    key: 'pair-programmer',
    name: 'Pair Programmer',
    path: '/workspace',
    icon: <CodeOutlined />,
    status: 'Live',
    statusColor: 'green',
    actionLabel: 'Launch',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#667eea',
  },
  {
    key: 'test-data',
    name: 'Test Data',
    path: '/test-with-data',
    icon: <ExperimentOutlined />,
    status: 'Live',
    statusColor: 'green',
    actionLabel: 'Launch',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    color: '#f093fb',
  },
  {
    key: 'code-converter',
    name: 'Code Converter',
    path: '/migration',
    icon: <BranchesOutlined />,
    status: 'Live',
    statusColor: 'green',
    actionLabel: 'Launch',
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    color: '#4facfe',
  },
  {
    key: 'adam-generator',
    name: 'ADAM Generator',
    path: '/adam-generator',
    icon: <RocketOutlined />,
    status: 'Live',
    statusColor: 'green',
    actionLabel: 'Launch',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#667eea',
  },
  {
    key: 'dataset-comparer',
    name: 'Dataset Comparer',
    path: '/adam-dataset-comparer',
    icon: <DeploymentUnitOutlined />,
    status: 'Preview',
    statusColor: 'blue',
    actionLabel: 'Launch',
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    color: '#4facfe',
  },
  {
    key: 'code-comparer',
    name: 'Code Comparer',
    path: '/code-comparer',
    icon: <HighlightOutlined />,
    status: 'Preview',
    statusColor: 'blue',
    actionLabel: 'Launch',
    gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    color: '#fa709a',
  },
  {
    key: 'sdtm-generator',
    name: 'SDTM Generator',
    path: '/test-with-data',
    icon: <ExperimentOutlined />,
    status: 'Live',
    statusColor: 'green',
    actionLabel: 'Launch',
    gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    color: '#30cfd0',
  },
  {
    key: 'r-frontend',
    name: 'R Frontend',
    path: '/r-frontend',
    icon: <ThunderboltOutlined />,
    status: 'Live',
    statusColor: 'green',
    actionLabel: 'Launch',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    color: '#f093fb',
  },
  {
    key: 'analytics',
    name: 'Analytics',
    path: '/adam-data-analytics',
    icon: <DashboardOutlined />,
    status: 'In progress',
    statusColor: 'orange',
    actionLabel: 'Coming Soon',
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    color: '#4facfe',
  },
  {
    key: 'chatbot',
    name: 'Study ChatBot',
    path: '/study-chatbot',
    icon: <RobotOutlined />,
    status: 'Preview',
    statusColor: 'blue',
    actionLabel: 'Launch',
    gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    color: '#a8edea',
  },
  {
    key: 'traceability',
    name: 'Traceability',
    path: '/traceability',
    icon: <BranchesOutlined />,
    status: 'Live',
    statusColor: 'green',
    actionLabel: 'Launch',
    gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
    color: '#ffecd2',
  },
];

const LandingPage = ({ onStartProject, onOpenMigration, currentUser, onLogout, onNavigateToUtility }: LandingPageProps) => {
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [isTestDataVisible, setIsTestDataVisible] = useState(false);

  const handleUtilityLaunch = (path: string, key?: string) => {
    // Handle special cases for quick actions
    if (key === 'pair-programmer') {
      onStartProject();
      return;
    }
    
    if (key === 'test-data' || path === '/test-with-data') {
      setIsTestDataVisible(true);
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
    <div className="landing-page-visual">
      {/* Header Bar */}
      {currentUser && (
        <div className="landing-header-bar">
          <div className="header-content">
            <Space size="middle">
              <div className="user-avatar">
                <UserOutlined />
              </div>
              <Text strong style={{ color: '#f1f5f9' }}>{currentUser.full_name}</Text>
            </Space>
            <Button
              icon={<LogoutOutlined />}
              size="small"
              onClick={onLogout}
              className="logout-btn"
            >
              Logout
            </Button>
          </div>
        </div>
      )}

      {/* Hero Section - Visual First */}
      <section className="hero-visual">
        <div className="hero-visual-bg">
          <div className="hero-gradient-1"></div>
          <div className="hero-gradient-2"></div>
          <div className="hero-gradient-3"></div>
          <div className="hero-particles"></div>
        </div>
        <div className="hero-container-visual">
          <div className="hero-content-wrapper">
            <div className="hero-main-content">
              <div className="hero-badge-visual">
                <StarOutlined />
                <span>AI-Powered Clinical Data Platform</span>
              </div>
              
              <div className="hero-title-visual">
                <span className="hero-title-main">ADAM AI</span>
                <span className="hero-title-sub">Code Generator</span>
              </div>

              <div className="hero-ctas-visual">
                <Button
                  type="primary"
                  size="large"
                  icon={<RocketOutlined />}
                  onClick={onStartProject}
                  className="cta-primary-visual"
                >
                  Start Project
                  <ArrowRightOutlined />
                </Button>
                <Button
                  size="large"
                  icon={<PlayCircleOutlined />}
                  onClick={() => setIsTestDataVisible(true)}
                  className="cta-secondary-visual"
                >
                  Test Data
                </Button>
              </div>
            </div>

            {/* CTA Section - Moved to right side */}
            <div className="cta-side-section">
              <div className="cta-icon-large">
                <RocketOutlined />
              </div>
              <Title level={2} className="cta-title-visual">Ready to Get Started?</Title>
              <Button
                type="primary"
                size="large"
                icon={<RocketOutlined />}
                onClick={onStartProject}
                className="cta-button-visual"
              >
                Launch Workspace
                <ArrowRightOutlined style={{ marginLeft: 8 }} />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* All Tools Grid - Visual Only */}
      <section className="features-visual-section">
        <div className="section-container-visual">
          <Title level={2} className="section-title-visual">All Tools</Title>
          <div className="features-grid-visual">
            {utilityFeatures.map((feature) => (
              <Card
                key={feature.key}
                className="feature-card-visual"
                hoverable
                onClick={() => handleUtilityLaunch(feature.path, feature.key)}
                style={{ borderColor: feature.color + '40' }}
              >
                <div className="feature-visual-header">
                  <div 
                    className="feature-icon-visual"
                    style={{ background: feature.gradient }}
                  >
                    {feature.icon}
                  </div>
                  <Tag color={feature.statusColor} className="feature-status-visual">
                    {feature.status}
                  </Tag>
                </div>
                <Title level={4} className="feature-name-visual">{feature.name}</Title>
                <Button 
                  type="text"
                  className="feature-action-visual"
                  style={{ color: feature.color }}
                >
                  {feature.actionLabel}
                  <ArrowRightOutlined style={{ marginLeft: 8 }} />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <HelpPage visible={isHelpVisible} onClose={() => setIsHelpVisible(false)} />
    </div>
  );
};

export default LandingPage;
