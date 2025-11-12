import { Button, Typography, Space } from 'antd';
import { 
  RocketOutlined, 
  CodeOutlined
} from '@ant-design/icons';
import './LandingPage.css';

const { Title, Paragraph } = Typography;

interface LandingPageProps {
  onStartProject: () => void;
}

const LandingPage = ({ onStartProject }: LandingPageProps) => {
  return (
    <div className="landing-page">
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
              onClick={() => window.open('/api/docs', '_blank')}
              className="secondary-button"
            >
              View API Docs
            </Button>
          </Space>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
