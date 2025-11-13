import { Button, Typography, Space, Tag } from 'antd';
import { 
  RocketOutlined, 
  CodeOutlined,
  LogoutOutlined,
  UserOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useState } from 'react';
import { CdiscConfigModal, type CdiscConfiguration } from './CdiscConfigModal';
import { useProjectStore } from '../store/projectStore';
import './LandingPage.css';

const { Title, Paragraph } = Typography;

interface LandingPageProps {
  onStartProject: () => void;
  currentUser?: any;
  onLogout?: () => void;
}

const LandingPage = ({ onStartProject, currentUser, onLogout }: LandingPageProps) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const { cdiscConfig, setCdiscConfig } = useProjectStore();

  const handleSaveConfig = (config: CdiscConfiguration) => {
    setCdiscConfig(config);
    setIsModalVisible(false);
  };

  const configDisplay = cdiscConfig 
    ? `${cdiscConfig.adamIgVersion}, ${cdiscConfig.sdtmVersion}` 
    : 'Not configured';

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
            Transform your clinical trial data analysis with AI-powered ADAM dataset generation.
            <br />
            Professional, compliant code in minutes, not days.
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
              icon={<SettingOutlined />}
              onClick={() => setIsModalVisible(true)}
              className="secondary-button"
            >
              Configure CDISC Standards
              {cdiscConfig && (
                <Tag 
                  color="success" 
                  style={{ marginLeft: 8 }}
                >
                  {configDisplay}
                </Tag>
              )}
            </Button>
            <Button 
              size="large"
              onClick={() => window.open('/api/docs', '_blank')}
              className="secondary-button"
            >
              View API Docs
            </Button>
          </Space>
        </div>
      </div>

      {/* CDISC Configuration Modal */}
      <CdiscConfigModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSave={handleSaveConfig}
        currentConfig={cdiscConfig || undefined}
      />
    </div>
  );
};

export default LandingPage;
