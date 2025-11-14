import { useState } from 'react';
import { Button, Card, Typography, Tag } from 'antd';
import { FolderKanban, ArrowLeft } from 'lucide-react';
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
      <div className="projects-header">
        <div className="projects-header-left">
          {onBack && (
            <Button
              icon={<ArrowLeft size={16} />}
              onClick={onBack}
              type="link"
              className="projects-back-btn"
            >
              Back
            </Button>
          )}
          <div>
            <Title level={3} style={{ marginBottom: 0 }}>
              Projects & Studies
            </Title>
            <Paragraph style={{ marginBottom: 0, color: '#6b7280' }}>
              Select a study to open its configuration workspace.
            </Paragraph>
          </div>
        </div>

        <Button
          type="primary"
          size="large"
          disabled={!selectedStudy}
          onClick={() => selectedStudy && onOpenStudy(selectedStudy.name)}
        >
          Open Study
        </Button>
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
  );
};

export default ProjectsPage;
