import { useState } from 'react';
import { Button, Card, Typography, Tag, Badge } from 'antd';
import { FolderKanban, ArrowLeft, Sparkles, Zap, FileCode } from 'lucide-react';
import { FolderOpenOutlined, RocketOutlined, FileTextOutlined, CodeOutlined, CheckCircleOutlined as AntCheckCircle } from '@ant-design/icons';
import './ProjectsPage.css';

const { Title, Paragraph } = Typography;

interface Study {
  id: string;
  name: string;
  sponsor?: string;
  therapeuticArea?: string;
  description?: string;
  lastUpdated?: string;
}

interface ProjectsPageProps {
  onOpenStudy: (studyName: string) => void;
  onBack?: () => void;
  studies?: Study[];
}

const ProjectsPage = ({
  onOpenStudy,
  onBack,
  studies = [
    {
      id: 'demo-study-1',
      name: 'Demo Study 1',
      sponsor: 'Demo Sponsor',
      therapeuticArea: 'General Medicine',
      description: 'Preconfigured workspace showcasing ADAM AI workflow.',
      lastUpdated: 'Updated today',
    },
  ],
}: ProjectsPageProps) => {
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(studies[0]?.id || null);

  const selectedStudy = studies.find((study) => study.id === selectedStudyId) || null;

  return (
    <div className="projects-page">
      {/* Hero Intelligence Banner - Top Priority */}
      <div className="hero-intelligence-banner">
        <div className="intelligence-glow"></div>
        <div className="intelligence-content">
          <div className="intelligence-badge">
            <Sparkles size={18} className="sparkle-icon" />
            <span>AI-Powered Workflow</span>
            <Sparkles size={18} className="sparkle-icon" />
          </div>
          <Title level={1} className="intelligence-title">
            Your Journey to ADAM Code
          </Title>
          <Paragraph className="intelligence-subtitle">
            Experience seamless automation from study selection to production-ready code
          </Paragraph>
          
          <div className="workflow-steps-container">
            <div className="workflow-step active">
              <div className="step-icon-wrapper">
                <div className="step-pulse"></div>
                <FolderOpenOutlined className="step-icon" />
              </div>
              <div className="step-content">
                <div className="step-title">Select Study</div>
                <div className="step-description">Choose your project workspace</div>
              </div>
              <div className="step-number">1</div>
            </div>
            
            <div className="step-connector"></div>
            
            <div className="workflow-step">
              <div className="step-icon-wrapper">
                <FileTextOutlined className="step-icon" />
              </div>
              <div className="step-content">
                <div className="step-title">Configure</div>
                <div className="step-description">Upload specifications & settings</div>
              </div>
              <div className="step-number">2</div>
            </div>
            
            <div className="step-connector"></div>
            
            <div className="workflow-step">
              <div className="step-icon-wrapper">
                <CodeOutlined className="step-icon" />
              </div>
              <div className="step-content">
                <div className="step-title">Generate</div>
                <div className="step-description">AI creates optimized code</div>
              </div>
              <div className="step-number">3</div>
            </div>
            
            <div className="step-connector"></div>
            
            <div className="workflow-step">
              <div className="step-icon-wrapper">
                <AntCheckCircle className="step-icon" />
              </div>
              <div className="step-content">
                <div className="step-title">ADAM Code</div>
                <div className="step-description">Production-ready deliverable</div>
              </div>
              <div className="step-number">4</div>
            </div>
          </div>

          <div className="intelligence-features">
            <div className="feature-chip">
              <Zap size={14} />
              <span>Auto-Configure</span>
            </div>
            <div className="feature-chip">
              <Sparkles size={14} />
              <span>AI Analysis</span>
            </div>
            <div className="feature-chip">
              <FileCode size={14} />
              <span>Smart Generation</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Card - Selected Study */}
      {selectedStudy && (
        <div className="quick-action-section">
          <div className="quick-action-card">
            <div className="action-card-left">
              <div className="selected-study-badge">
                <AntCheckCircle style={{ fontSize: 18 }} />
                <span>Selected Study</span>
              </div>
              <Title level={3} style={{ marginBottom: 8, color: '#111827', fontWeight: 700, fontSize: '24px' }}>
                {selectedStudy.name}
              </Title>
              <div className="quick-details">
                <span className="quick-detail-item">
                  <strong>Sponsor:</strong> {selectedStudy.sponsor}
                </span>
                {selectedStudy.therapeuticArea && (
                  <>
                    <span className="detail-separator">•</span>
                    <span className="quick-detail-item">
                      <strong>Area:</strong> {selectedStudy.therapeuticArea}
                    </span>
                  </>
                )}
              </div>
              <Paragraph style={{ marginBottom: 0, color: '#6b7280', fontSize: '14px', marginTop: 12 }}>
                Launch workspace to configure settings and generate AI-powered ADAM code
              </Paragraph>
            </div>
            <div className="action-card-right">
              <Button
                type="primary"
                size="large"
                icon={<FolderOpenOutlined />}
                onClick={() => onOpenStudy(selectedStudy.name)}
                className="launch-workspace-button"
              >
                Open Study Workspace
              </Button>
              <div className="quick-features">
                <Zap size={14} />
                <span>Auto-configure • AI Analysis • Code Generation</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="projects-header-container">
        <div className="projects-header">
          <div className="projects-header-left">
            {onBack && (
              <Button
                icon={<ArrowLeft size={16} />}
                onClick={onBack}
                type="link"
                className="projects-back-btn"
              >
                Back to Home
              </Button>
            )}
            <div className="header-text">
              <div className="title-row">
                <RocketOutlined className="header-rocket-icon" />
                <Title level={2} style={{ marginBottom: 0, color: '#111827' }}>
                  Select Your Study
                </Title>
              </div>
              <Paragraph style={{ marginBottom: 0, color: '#6b7280', fontSize: '15px', marginTop: 8 }}>
                Choose a study workspace to begin your AI-powered journey
              </Paragraph>
            </div>
          </div>
        </div>
      </div>

      {/* Studies Grid Section */}
      <div className="studies-section">
        <div className="section-header">
          <div className="section-title-row">
            <FolderKanban size={20} className="section-icon" />
            <Title level={4} style={{ margin: 0, color: '#374151' }}>Available Studies</Title>
            <Badge count={studies.length} style={{ backgroundColor: '#667eea' }} />
          </div>
          <Paragraph className="section-description">
            Select a study to access its workspace and begin configuration
          </Paragraph>
        </div>

        <div className="projects-grid">
        {studies.map((study) => {
          const isSelected = study.id === selectedStudyId;
          return (
            <Card
              key={study.id}
              className={`study-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedStudyId(study.id)}
              hoverable
            >
              <div className="study-card-header">
                <div className="study-icon">
                  <FolderKanban size={20} />
                </div>
                <div className="study-title">
                  <div className="study-name">{study.name}</div>
                  {study.sponsor && <div className="study-sponsor">{study.sponsor}</div>}
                </div>
                {isSelected && <Tag color="blue">Selected</Tag>}
              </div>
              <Paragraph className="study-description">
                {study.description || 'No description provided'}
              </Paragraph>
              <div className="study-meta">
                {study.therapeuticArea && (
                  <span className="study-meta-item">{study.therapeuticArea}</span>
                )}
                {study.lastUpdated && (
                  <span className="study-meta-item">{study.lastUpdated}</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
      </div>
    </div>
  );
};

export default ProjectsPage;
