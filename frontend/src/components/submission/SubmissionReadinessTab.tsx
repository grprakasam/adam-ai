// @ts-nocheck
/**
 * Submission Readiness Tab
 * Main container for FDA submission validation and package generation
 */

import React, { useState, useEffect } from 'react';
import { Tabs, Card, Alert, Progress, Button, Tooltip, Space } from 'antd';
import {
  ReloadOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { useProjectStore } from '../../store/projectStore';
import SubmissionDashboard from './SubmissionDashboard';
import ValidationPanel from './ValidationPanel';
import PackageGenerator from './PackageGenerator';
import './SubmissionReadinessTab.css';

const { TabPane } = Tabs;

const SubmissionReadinessTab: React.FC = () => {
  const {
    studyId,
    selectedDataset,
    submissionReadinessScore,
    refreshReadinessScore,
  } = useProjectStore();

  const [activeView, setActiveView] = useState<'dashboard' | 'validation' | 'package' | 'artifacts'>('dashboard');
  const [showHelp, setShowHelp] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    // Check if first visit for onboarding
    const visited = localStorage.getItem('submission_readiness_visited');
    if (!visited) {
      setIsFirstVisit(true);
      localStorage.setItem('submission_readiness_visited', 'true');
    }

    // Auto-refresh readiness score on mount
    if (studyId && selectedDataset) {
      refreshReadinessScore();
    }
  }, [studyId, selectedDataset, refreshReadinessScore]);

  // Use actual score from store, fallback to mock
  const currentScore = submissionReadinessScore?.overall || 78;

  return (
    <div className="submission-readiness-tab">
      {/* First Visit Onboarding Banner */}
      {isFirstVisit && (
        <Alert
          message="Welcome to Submission Readiness"
          description="This tool helps you validate your ADaM datasets and generate FDA submission packages. Start by running validation checks, then generate your submission artifacts."
          type="info"
          showIcon
          closable
          onClose={() => setIsFirstVisit(false)}
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={() => setShowHelp(true)}>
              Learn More
            </Button>
          }
        />
      )}

      {/* Quick Context Bar */}
      <Card size="small" style={{ marginBottom: 16 }} className="context-bar">
        <Space size="large">
          <span><strong>Study:</strong> {studyId || 'Not selected'}</span>
          <span>|</span>
          <span><strong>Dataset:</strong> {selectedDataset || 'Not selected'}</span>
          <span>|</span>
          <span>
            <strong>Readiness:</strong>{' '}
            <Progress
              type="circle"
              percent={currentScore}
              width={40}
              format={(percent) => `${percent}%`}
              strokeColor={
                currentScore >= 80
                  ? '#52c41a'
                  : currentScore >= 50
                  ? '#faad14'
                  : '#ff4d4f'
              }
            />
          </span>
          <Tooltip title="Refresh readiness score">
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={refreshReadinessScore}
            />
          </Tooltip>
        </Space>
      </Card>

      {/* Main Content Tabs */}
      <Tabs
        activeKey={activeView}
        onChange={(key) => setActiveView(key as typeof activeView)}
        tabBarExtraContent={
          <Button
            icon={<QuestionCircleOutlined />}
            onClick={() => setShowHelp(!showHelp)}
          >
            Help
          </Button>
        }
        className="submission-tabs"
      >
        <TabPane tab="Dashboard" key="dashboard">
          <SubmissionDashboard onNavigate={setActiveView} />
        </TabPane>

        <TabPane tab="Validation" key="validation">
          <ValidationPanel onBack={() => setActiveView('dashboard')} />
        </TabPane>

        <TabPane tab="Package" key="package">
          <PackageGenerator onBack={() => setActiveView('dashboard')} />
        </TabPane>

        <TabPane tab="Artifacts" key="artifacts">
          <div className="artifacts-placeholder">
            <Card>
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <h2>Artifacts</h2>
                <p style={{ color: '#666' }}>
                  Coming soon: View and download generated submission artifacts.
                </p>
              </div>
            </Card>
          </div>
        </TabPane>
      </Tabs>
      {/* Help Sidebar - Placeholder */}
      {showHelp && (
        <div className="help-sidebar">
          <Card
            title="Help"
            extra={<Button onClick={() => setShowHelp(false)}>Close</Button>}
            style={{
              position: 'fixed',
              right: 16,
              top: 100,
              width: 400,
              maxHeight: 'calc(100vh - 120px)',
              overflow: 'auto',
              zIndex: 1000,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            <p>
              <strong>Submission Readiness</strong> helps you prepare FDA-compliant
              submission packages.
            </p>
            <h4>Quick Start:</h4>
            <ol>
              <li>Select study and dataset from project configuration</li>
              <li>Run validation checks to identify issues</li>
              <li>Generate submission artifacts (Define.xml, ADRG, SDRG)</li>
              <li>Create eCTD package for submission</li>
            </ol>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SubmissionReadinessTab;
