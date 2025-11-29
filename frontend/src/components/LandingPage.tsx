import { Button, Typography, Tag, Card, Space, Tabs } from 'antd';
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
  DatabaseOutlined,
  ToolOutlined,
  SwapOutlined,
  CheckCircleOutlined,
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

interface CategoryFeatures {
  categoryKey: string;
  categoryName: string;
  categoryIcon: ReactNode;
  categoryGradient: string;
  features: UtilityFeature[];
}

const categorizedFeatures: CategoryFeatures[] = [
  {
    categoryKey: 'sdtm-ai',
    categoryName: 'SDTM.AI',
    categoryIcon: <DatabaseOutlined />,
    categoryGradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
    features: [
      {
        key: 'sdtm-generator',
        name: 'SDTM Test Data Generator',
        path: '/test-with-data',
        icon: <ExperimentOutlined />,
        status: 'Live',
        statusColor: 'green',
        actionLabel: 'Launch',
        gradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        color: '#1890ff',
      },
    ],
  },
  {
    categoryKey: 'adam-ai',
    categoryName: 'ADAM.AI',
    categoryIcon: <RocketOutlined />,
    categoryGradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
    features: [
      {
        key: 'adam-generator',
        name: 'ADAM Generator',
        path: '/adam-generator',
        icon: <RocketOutlined />,
        status: 'Live',
        statusColor: 'green',
        actionLabel: 'Launch',
        gradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        color: '#1890ff',
      },
      {
        key: 'traceability',
        name: 'Traceability',
        path: '/traceability',
        icon: <BranchesOutlined />,
        status: 'Live',
        statusColor: 'green',
        actionLabel: 'Launch',
        gradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        color: '#1890ff',
      },
      {
        key: 'pair-programmer',
        name: 'Pair Programmer',
        path: '/workspace',
        icon: <CodeOutlined />,
        status: 'Live',
        statusColor: 'green',
        actionLabel: 'Launch',
        gradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        color: '#1890ff',
      },
    ],
  },
  {
    categoryKey: 'tlf-ai',
    categoryName: 'TLF.AI',
    categoryIcon: <FileTextOutlined />,
    categoryGradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
    features: [
      {
        key: 'tlf-generator',
        name: 'TLF Generator',
        path: '/tlf-generator',
        icon: <FileTextOutlined />,
        status: 'Live',
        statusColor: 'green',
        actionLabel: 'Launch',
        gradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        color: '#1890ff',
      },
    ],
  },
  {
    categoryKey: 'compliance-ai',
    categoryName: 'Compliance.AI',
    categoryIcon: <SafetyOutlined />,
    categoryGradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
    features: [
      {
        key: 'submission',
        name: 'Submission',
        path: '/submission-dashboard',
        icon: <CheckCircleOutlined />,
        status: 'Live',
        statusColor: 'green',
        actionLabel: 'Launch',
        gradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        color: '#1890ff',
      },
    ],
  },
  {
    categoryKey: 'code-migration',
    categoryName: 'CodeMigration.AI',
    categoryIcon: <SwapOutlined />,
    categoryGradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
    features: [
      {
        key: 'code-converter',
        name: 'SAS to R Conversion Framework',
        path: '/migration',
        icon: <BranchesOutlined />,
        status: 'Live',
        statusColor: 'green',
        actionLabel: 'Launch',
        gradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        color: '#1890ff',
      },
    ],
  },
  {
    categoryKey: 'ai-utilities',
    categoryName: 'Utilities.AI',
    categoryIcon: <ToolOutlined />,
    categoryGradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
    features: [
      {
        key: 'chatbot',
        name: 'Study ChatBot',
        path: '/study-chatbot',
        icon: <RobotOutlined />,
        status: 'Preview',
        statusColor: 'blue',
        actionLabel: 'Launch',
        gradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        color: '#1890ff',
      },
      {
        key: 'code-comparer',
        name: 'Code Comparer',
        path: '/code-comparer',
        icon: <HighlightOutlined />,
        status: 'Preview',
        statusColor: 'blue',
        actionLabel: 'Launch',
        gradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        color: '#1890ff',
      },
      {
        key: 'dataset-comparer',
        name: 'Dataset Comparer',
        path: '/adam-dataset-comparer',
        icon: <DeploymentUnitOutlined />,
        status: 'Preview',
        statusColor: 'blue',
        actionLabel: 'Launch',
        gradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        color: '#1890ff',
      },
      {
        key: 'analytics',
        name: 'Analytics',
        path: '/adam-data-analytics',
        icon: <DashboardOutlined />,
        status: 'In progress',
        statusColor: 'orange',
        actionLabel: 'Coming Soon',
        gradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        color: '#1890ff',
      },
      {
        key: 'r-frontend',
        name: 'R Frontend',
        path: '/r-frontend',
        icon: <ThunderboltOutlined />,
        status: 'Live',
        statusColor: 'green',
        actionLabel: 'Launch',
        gradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        color: '#1890ff',
      },
    ],
  },
];

const LandingPage = ({ onStartProject, onOpenMigration, currentUser, onLogout, onNavigateToUtility }: LandingPageProps) => {
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [isTestDataVisible, setIsTestDataVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');

  const handleUtilityLaunch = (path: string, key?: string) => {
    // Handle special cases for quick actions
    if (key === 'pair-programmer') {
      onStartProject();
      return;
    }
    
    // SDTM Test Data Generator should use normal navigation
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
              <Text strong style={{ color: '#262626' }}>{currentUser.full_name}</Text>
            </Space>
            <Space size="middle">
              <Button
                icon={<QuestionCircleOutlined />}
                size="small"
                onClick={() => setIsHelpVisible(true)}
                className="help-btn"
              >
                Help
              </Button>
              <Button
                type="primary"
                icon={<RocketOutlined />}
                onClick={onStartProject}
                className="start-project-btn"
              >
                Start Project
              </Button>
              <Button
                icon={<LogoutOutlined />}
                size="small"
                onClick={onLogout}
                className="logout-btn"
              >
                Logout
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* Tools Section with Tabs - Space Efficient */}
      <section className="features-visual-section">
        <div className="section-container-visual">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            className="category-tabs"
            items={[
              {
                key: 'all',
                label: (
                  <span className="tab-label">
                    <ToolOutlined />
                    All Tools
                  </span>
                ),
                children: (
                  <div className="features-grid-visual">
                    {categorizedFeatures.flatMap(category => 
                      category.features.map((feature) => (
                        <Card
                          key={feature.key}
                          className="feature-card-visual"
                          hoverable
                          onClick={() => handleUtilityLaunch(feature.path, feature.key)}
                        >
                          <div className="feature-visual-header">
                            <div className="feature-icon-visual">
                              {feature.icon}
                            </div>
                            <Tag color={feature.statusColor} className="feature-status-visual">
                              {feature.status}
                            </Tag>
                          </div>
                          <Title level={5} className="feature-name-visual">{feature.name}</Title>
                          <Button 
                            type="text"
                            className="feature-action-visual"
                          >
                            {feature.actionLabel}
                            <ArrowRightOutlined style={{ marginLeft: 6 }} />
                          </Button>
                        </Card>
                      ))
                    )}
                  </div>
                ),
              },
              ...categorizedFeatures.map((category) => ({
                key: category.categoryKey,
                label: (
                  <span className="tab-label">
                    {category.categoryIcon}
                    {category.categoryName}
                  </span>
                ),
                children: (
                  <div className="features-grid-visual">
                    {category.features.map((feature) => (
                      <Card
                        key={feature.key}
                        className="feature-card-visual"
                        hoverable
                        onClick={() => handleUtilityLaunch(feature.path, feature.key)}
                      >
                        <div className="feature-visual-header">
                          <div className="feature-icon-visual">
                            {feature.icon}
                          </div>
                          <Tag color={feature.statusColor} className="feature-status-visual">
                            {feature.status}
                          </Tag>
                        </div>
                        <Title level={5} className="feature-name-visual">{feature.name}</Title>
                        <Button 
                          type="text"
                          className="feature-action-visual"
                        >
                          {feature.actionLabel}
                          <ArrowRightOutlined style={{ marginLeft: 6 }} />
                        </Button>
                      </Card>
                    ))}
                  </div>
                ),
              })),
            ]}
          />
        </div>
      </section>

      <HelpPage visible={isHelpVisible} onClose={() => setIsHelpVisible(false)} />
    </div>
  );
};

export default LandingPage;
