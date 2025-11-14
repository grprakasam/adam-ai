import { Button, Typography, Space } from 'antd';
import { 
  RocketOutlined, 
  CodeOutlined,
  LogoutOutlined,
  UserOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { useState } from 'react';
import HelpPage from './HelpPage';
import './LandingPage.css';

const { Title, Paragraph } = Typography;

interface LandingPageProps {
  onStartProject: () => void;
  currentUser?: any;
  onLogout?: () => void;
}

const LandingPage = ({ onStartProject, currentUser, onLogout }: LandingPageProps) => {
  const [isHelpVisible, setIsHelpVisible] = useState(false);

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
          
          <Space size="large" style={{ marginTop: 32 }}>
            <Button 
              type="primary" 
              size="large" 
              icon={<CodeOutlined />}
              onClick={onStartProject}
              className="cta-button"
            >
              Get Started
            </Button>
            <Button 
              size="large"
              icon={<QuestionCircleOutlined />}
              onClick={() => setIsHelpVisible(true)}
              className="secondary-button"
            >
              Help
            </Button>
          </Space>
        </div>
      </div>

      {/* Help Modal */}
      <HelpPage visible={isHelpVisible} onClose={() => setIsHelpVisible(false)} />
    </div>
  );
};

export default LandingPage;
