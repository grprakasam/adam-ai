import { Button, Typography } from 'antd';
import { 
  RocketOutlined, 
  CodeOutlined,
  LogoutOutlined,
  UserOutlined,
  QuestionCircleOutlined,
  BranchesOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import HelpPage from './HelpPage';
import { TestWithDataPanel } from './TestWithDataPanel';
import './LandingPage.css';

const { Title, Paragraph } = Typography;

interface LandingPageProps {
  onStartProject: () => void;
  onOpenMigration: () => void;
  currentUser?: any;
  onLogout?: () => void;
}

const LandingPage = ({ onStartProject, onOpenMigration, currentUser, onLogout }: LandingPageProps) => {
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [isTestDataVisible, setIsTestDataVisible] = useState(false);

  if (isTestDataVisible) {
    return (
      <div style={{ padding: '24px', background: '#f5f7fa', minHeight: '100vh' }}>
        <Button
          onClick={() => setIsTestDataVisible(false)}
          style={{ marginBottom: 16 }}
        >
          ← Back to Landing
        </Button>
        <TestWithDataPanel standalone={true} />
      </div>
    );
  }

  return (
    <div className="landing-page">
      {/* User info in top right */}
      {currentUser && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '8px 16px',
          borderRadius: '8px',
          backdropFilter: 'blur(10px)',
          color: 'white',
        }}>
          <UserOutlined style={{ fontSize: '16px' }} />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>{currentUser.full_name}</span>
          <Button
            icon={<LogoutOutlined />}
            size="small"
            onClick={onLogout}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
            }}
          >
            Logout
          </Button>
        </div>
      )}
      
      <div className="landing-hero">
        <div className="hero-content">
          <RocketOutlined style={{ fontSize: 64, color: 'white', marginBottom: 24 }} />
          <Title level={1} className="hero-title">
            ADAM AI Code Generator
          </Title>
          <Paragraph className="hero-subtitle">
            ADAM Dataset Creation with AI Assistance
          </Paragraph>
          
          <div className="cta-options">
            <div className="cta-card primary">
              <Button 
                size="large"
                icon={<CodeOutlined />}
                onClick={onStartProject}
                className="cta-button"
                block
              >
                ADAM AI Pair Programmer
              </Button>
              <Paragraph className="cta-caption">
                Launch a new ADAM workspace for a study or project.
              </Paragraph>
            </div>

            <div className="cta-card secondary">
              <Button 
                size="large"
                icon={<ExperimentOutlined />}
                onClick={() => setIsTestDataVisible(true)}
                className="secondary-button secondary-outline"
                block
              >
                Test With Data
              </Button>
              <Paragraph className="cta-caption">
                Generate mock SDTM datasets for testing your ADAM programs with realistic data.
              </Paragraph>
            </div>

            <div className="cta-card secondary">
              <Button 
                size="large"
                icon={<BranchesOutlined />}
                onClick={onOpenMigration}
                className="secondary-button secondary-outline"
                block
              >
                AI Code Converter
              </Button>
              <Paragraph className="cta-caption">
                Upload existing SAS/R code, let AI map derivations, and regenerate optimized programs.
              </Paragraph>
            </div>

            <div className="cta-card tertiary">
              <Button 
                size="large"
                icon={<QuestionCircleOutlined />}
                onClick={() => setIsHelpVisible(true)}
                className="secondary-button ghost"
                block
              >
                Help & Guides
              </Button>
              <Paragraph className="cta-caption">
                Access quick-start tutorials, FAQs, and platform tips.
              </Paragraph>
            </div>
          </div>
        </div>
      </div>

      {/* Help Modal */}
      <HelpPage visible={isHelpVisible} onClose={() => setIsHelpVisible(false)} />
    </div>
  );
};

export default LandingPage;
