import React, { useState, useEffect } from 'react';
import { Button, Card, Typography, Space, Empty } from 'antd';
import { PlusCircleOutlined, FolderOpenOutlined, ArrowLeftOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useStudyStore } from '../store/studyStore';
import { StudySelector } from './StudySelector';
import './ProjectSelectionPage.css';

const { Title, Paragraph, Text } = Typography;

interface ProjectSelectionPageProps {
  onCreateNew: () => void;
  onContinueExisting: (studyId: string) => void;
  onBack?: () => void;
}

const ProjectSelectionPage: React.FC<ProjectSelectionPageProps> = ({
  onCreateNew,
  onContinueExisting,
  onBack
}) => {
  const { studies, studiesLoading, loadStudies, currentStudyId, setCurrentStudy, studiesLoadedAt } = useStudyStore();
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null);

  // Always trigger an initial load (forced) so the dropdown populates promptly
  useEffect(() => {
    loadStudies(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentStudyId) {
      setSelectedStudyId(currentStudyId);
    }
  }, [currentStudyId]);

  const handleContinueStudy = async () => {
    if (selectedStudyId) {
      await setCurrentStudy(selectedStudyId);
      onContinueExisting(selectedStudyId);
    }
  };

  return (
    <div className="project-selection-page">
      {onBack && (
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          className="back-button"
        >
          Back to Home
        </Button>
      )}

      <div className="project-selection-header">
        <div className="header-icon">
          <ThunderboltOutlined />
        </div>
        <Title level={1} className="page-title">Start Your Project</Title>
        <Paragraph className="page-subtitle">
          Choose to create a new study or continue working on an existing one
        </Paragraph>
      </div>

      <div className="project-selection-options">
        {/* Create New Project Option */}
        <Card
          className="selection-card create-card"
          hoverable
          onClick={onCreateNew}
        >
          <div className="card-content">
            <div className="card-icon create-icon">
              <PlusCircleOutlined />
            </div>
            <Title level={3} className="card-title">Create New Study</Title>
            <Paragraph className="card-description">
              Start fresh with a new clinical study. Enter study details, configure standards,
              and set up datasets for your ADAM code generation workflow.
            </Paragraph>
            <div className="card-features">
              <Text className="feature-item">✓ Enter study details</Text>
              <Text className="feature-item">✓ Configure CDISC standards</Text>
              <Text className="feature-item">✓ Select ADAM datasets</Text>
            </div>
            <Button
              type="primary"
              size="large"
              icon={<PlusCircleOutlined />}
              className="card-action-button"
              onClick={(e) => {
                e.stopPropagation();
                onCreateNew();
              }}
            >
              Create New Study
            </Button>
          </div>
        </Card>

        {/* Continue Existing Study Option */}
        <Card
          className={`selection-card continue-card ${selectedStudyId ? 'has-selection' : ''}`}
          hoverable={!!selectedStudyId}
        >
          <div className="card-content">
            <div className="card-icon continue-icon">
              <FolderOpenOutlined />
            </div>
            <Title level={3} className="card-title">Continue Existing Study</Title>
            <Paragraph className="card-description">
              Select a study from your workspace to resume work, view configurations,
              or generate additional ADAM code.
            </Paragraph>

            <div className="study-selector-section">
              {studiesLoading && studies.length === 0 ? (
                <div className="loading-state">
                  <Text type="secondary">Loading studies...</Text>
                  <Button
                    size="small"
                    style={{ marginTop: 12 }}
                    onClick={() => loadStudies(true)}
                    loading={studiesLoading}
                  >
                    Retry
                  </Button>
                </div>
              ) : studies.length === 0 ? (
                <Empty
                  description="No existing studies found"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  className="empty-studies"
                >
                  <Text type="secondary" className="empty-hint">
                    Create a new study to get started
                  </Text>
                  <Button
                    size="small"
                    style={{ marginTop: 12 }}
                    onClick={() => loadStudies(true)}
                    loading={studiesLoading}
                  >
                    Reload studies
                  </Button>
                </Empty>
              ) : (
                <div className="study-selector-wrapper">
                  <Text strong className="selector-label">
                    Select a Study:
                  </Text>
                  <StudySelector
                    value={selectedStudyId || undefined}
                    onChange={(studyId) => setSelectedStudyId(studyId)}
                    showCreateButton={false}
                  />
                  <Button
                    size="small"
                    style={{ marginTop: 8 }}
                    onClick={() => loadStudies(true)}
                    loading={studiesLoading}
                  >
                    Refresh list
                  </Button>
                </div>
              )}
            </div>

            <Button
              type="primary"
              size="large"
              icon={<FolderOpenOutlined />}
              className="card-action-button"
              disabled={!selectedStudyId || studies.length === 0}
              onClick={handleContinueStudy}
            >
              Continue Selected Study
            </Button>
          </div>
        </Card>
      </div>

      <div className="project-selection-footer">
        <Paragraph className="footer-hint" type="secondary">
          💡 Tip: New studies require basic information and CDISC standards configuration before you can generate code.
        </Paragraph>
      </div>
    </div>
  );
};

export default ProjectSelectionPage;

