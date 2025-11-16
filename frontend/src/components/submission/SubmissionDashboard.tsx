/**
 * Submission Dashboard Component
 * Overview of submission readiness with score, component status, and quick actions
 */

import React, { useEffect } from 'react';
import { Card, Row, Col, Progress, Button, Timeline, Statistic, Badge, Space, Empty } from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  RocketOutlined,
  FileTextOutlined,
  DownloadOutlined,
  SyncOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useProjectStore } from '../../store/projectStore';
import './SubmissionDashboard.css';

interface Props {
  onNavigate: (view: string) => void;
}

const SubmissionDashboard: React.FC<Props> = ({ onNavigate }) => {
  const {
    submissionReadinessScore,
    recentActivity,
    isValidating,
    runAllValidations,
    refreshReadinessScore,
  } = useProjectStore();

  useEffect(() => {
    // Auto-refresh score on mount
    refreshReadinessScore();
  }, [refreshReadinessScore]);

  const score = submissionReadinessScore?.overall || 0;
  const scoreColor = score >= 80 ? '#52c41a' : score >= 50 ? '#faad14' : '#ff4d4f';
  const scoreStatus = score >= 80 ? 'Ready' : score >= 50 ? 'Needs Work' : 'Not Ready';

  return (
    <div className="submission-dashboard">
      {/* Main Score Section */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card className="score-card">
            <div className="score-header">
              <h3>Submission Readiness Score</h3>
              <Badge
                status={score >= 80 ? 'success' : score >= 50 ? 'warning' : 'error'}
                text={scoreStatus}
              />
            </div>
            <div className="score-display">
              <Progress
                type="circle"
                percent={score}
                width={160}
                strokeWidth={8}
                strokeColor={{
                  '0%': '#667eea',
                  '100%': '#764ba2',
                }}
                format={(percent) => (
                  <div className="score-content">
                    <div className="score-number">{percent}</div>
                    <div className="score-label">Score</div>
                  </div>
                )}
              />
            </div>
            <div className="score-status" style={{ color: scoreColor }}>
              {score >= 80 && (
                <>
                  <CheckCircleOutlined /> Ready for Submission
                </>
              )}
              {score >= 50 && score < 80 && (
                <>
                  <WarningOutlined /> Review Required
                </>
              )}
              {score < 50 && (
                <>
                  <CloseCircleOutlined /> Incomplete
                </>
              )}
            </div>
          </Card>
        </Col>

        {/* Component Breakdown */}
        <Col xs={24} lg={16}>
          <Card title="Component Status" className="components-card">
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <ComponentStatus
                  title="Pre-P21"
                  score={submissionReadinessScore?.components?.preflight || 0}
                  icon={<CheckCircleOutlined />}
                />
              </Col>
              <Col xs={12} sm={6}>
                <ComponentStatus
                  title="CT Check"
                  score={submissionReadinessScore?.components?.controlled_terminology || 0}
                  icon={<CheckCircleOutlined />}
                />
              </Col>
              <Col xs={12} sm={6}>
                <ComponentStatus
                  title="P21 CE"
                  score={submissionReadinessScore?.components?.p21_validation || 0}
                  icon={<CheckCircleOutlined />}
                />
              </Col>
              <Col xs={12} sm={6}>
                <ComponentStatus
                  title="Define.xml"
                  score={submissionReadinessScore?.components?.define_xml || 0}
                  icon={<FileTextOutlined />}
                />
              </Col>
            </Row>
            {submissionReadinessScore?.recommendations && submissionReadinessScore.recommendations.length > 0 && (
              <div className="recommendations">
                <h4>Recommendations:</h4>
                <ul>
                  {submissionReadinessScore.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Quick Actions */}
      <Card
        title="Quick Actions"
        className="actions-card"
        extra={
          <Space>
            <Badge
              status={isValidating ? 'processing' : 'success'}
              text={isValidating ? 'Running...' : 'Ready'}
            />
            <Button
              icon={<SyncOutlined spin={isValidating} />}
              onClick={refreshReadinessScore}
              disabled={isValidating}
              size="small"
            >
              Refresh
            </Button>
          </Space>
        }
      >
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <div className="action-card">
              <Button
                type="primary"
                icon={<RocketOutlined />}
                size="large"
                block
                onClick={runAllValidations}
                loading={isValidating}
                className="action-button primary"
              >
                Run All Validation Checks
              </Button>
              <div className="action-description">
                Pre-P21 → CT → P21 CE in sequence
              </div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div className="action-card">
              <Button
                icon={<FileTextOutlined />}
                size="large"
                block
                onClick={() => onNavigate('package')}
                className="action-button"
              >
                Generate Submission Package
              </Button>
              <div className="action-description">
                Define.xml, ADRG, SDRG, eCTD
              </div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div className="action-card">
              <Button
                icon={<DownloadOutlined />}
                size="large"
                block
                onClick={() => onNavigate('artifacts')}
                className="action-button"
              >
                View Artifacts
              </Button>
              <div className="action-description">
                All generated files with checksums
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Recent Activity Timeline */}
      <Card title="Recent Activity" className="activity-card">
        {recentActivity && recentActivity.length > 0 ? (
          <Timeline>
            {recentActivity.map((item, index) => (
              <Timeline.Item
                key={index}
                color={
                  item.status === 'success'
                    ? 'green'
                    : item.status === 'warning'
                    ? 'orange'
                    : item.status === 'error'
                    ? 'red'
                    : 'blue'
                }
                dot={
                  item.status === 'success' ? (
                    <CheckCircleOutlined />
                  ) : item.status === 'warning' ? (
                    <WarningOutlined />
                  ) : item.status === 'error' ? (
                    <CloseCircleOutlined />
                  ) : (
                    <ClockCircleOutlined />
                  )
                }
              >
                <p className="activity-action">
                  <strong>{item.action}</strong>
                </p>
                <p className="activity-message">{item.message}</p>
                <p className="activity-timestamp">{item.timestamp}</p>
              </Timeline.Item>
            ))}
          </Timeline>
        ) : (
          <Empty
            description="No recent activity"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>
    </div>
  );
};

const ComponentStatus: React.FC<{
  title: string;
  score: number;
  icon: React.ReactNode;
}> = ({ title, score, icon }) => {
  const displayScore = score ?? 0;
  const status = displayScore === 0 ? 'Not Run' : `${displayScore}%`;
  const color =
    displayScore >= 80
      ? '#52c41a'
      : displayScore >= 50
      ? '#faad14'
      : displayScore === 0
      ? '#d9d9d9'
      : '#ff4d4f';

  return (
    <div className="component-status">
      <Progress
        type="circle"
        percent={displayScore}
        width={80}
        strokeWidth={6}
        strokeColor={color}
        format={() => (
          <div style={{ fontSize: 24, color }}>
            {icon}
          </div>
        )}
      />
      <div className="component-title">{title}</div>
      <div className="component-score" style={{ color }}>
        {status}
      </div>
    </div>
  );
};

export default SubmissionDashboard;
