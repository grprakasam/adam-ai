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
import { workflowGroups } from '../config/navigationConfig';
import './LandingPage.css';

const { Title, Text } = Typography;

interface LandingPageProps {
  onStartProject: () => void;
  onOpenMigration: () => void;
  onNavigateToUtility?: (path: string) => void;
  currentUser?: any;
  onLogout?: () => void;
}

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
              Clinical AI Workspace
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
