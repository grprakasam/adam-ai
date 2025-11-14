import { useState } from 'react';
import { Button, Card, Typography, Tag, Divider, Steps, Badge } from 'antd';
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
                Choose a study workspace to begin AI-powered ADAM code generation
              </Paragraph>
            </div>
          </div>
        </div>

        {/* Workflow Steps Banner */}
        <div className="workflow-banner">
          <div className="workflow-banner-header">
            <Sparkles size={20} className="sparkle-icon" />
            <span className="workflow-title">Your Journey to ADAM Code</span>
          </div>
          <Steps
            size="small"
            current={0}
            className="workflow-steps"
            items={[
              {
                title: 'Select Study',
                icon: <FolderOpenOutlined />,
                description: 'Choose your project'
              },
              {
                title: 'Configure',
                icon: <FileTextOutlined />,
                description: 'Set up specifications'
              },
              {
                title: 'Generate',
                icon: <CodeOutlined />,
                description: 'AI creates code'
              },
              {
                title: 'Deploy',
                icon: <AntCheckCircle />,
                description: 'Production ready'
              }
            ]}
          />
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

      {/* Centered Action Section */}
      {selectedStudy && (
        <div className="open-study-section">
          <div className="open-study-card">
            <div className="open-study-badge">
              <Zap size={16} className="zap-icon" />
              <span>Ready to Launch</span>
            </div>
            <div className="open-study-icon">
              <AntCheckCircle style={{ fontSize: 36 }} />
            </div>
            <Title level={3} style={{ marginBottom: 8, color: '#111827', fontWeight: 700 }}>
              {selectedStudy.name}
            </Title>
            <div className="study-details-preview">
              <div className="detail-item">
                <span className="detail-label">Sponsor:</span>
                <span className="detail-value">{selectedStudy.sponsor}</span>
              </div>
              {selectedStudy.therapeuticArea && (
                <div className="detail-item">
                  <span className="detail-label">Area:</span>
                  <span className="detail-value">{selectedStudy.therapeuticArea}</span>
                </div>
              )}
            </div>
            <Divider style={{ margin: '20px 0' }} />
            <Paragraph style={{ marginBottom: 28, color: '#6b7280', fontSize: '15px', lineHeight: 1.6 }}>
              Launch the workspace to configure your project settings, upload ADAM specifications, 
              and start AI-powered code generation.
            </Paragraph>
            <Button
              type="primary"
              size="large"
              icon={<FolderOpenOutlined />}
              onClick={() => onOpenStudy(selectedStudy.name)}
              className="open-study-button"
            >
              Open Study Workspace
            </Button>
            <div className="features-hint">
              <FileCode size={14} />
              <span>Auto-configure • AI Analysis • Code Generation</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
