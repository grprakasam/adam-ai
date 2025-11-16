/**
 * Validation Panel Component
 * 
 * Provides UI for running individual validation checks with progress tracking
 */

import React, { useState } from 'react';
import { Card, Button, Progress, Table, Tag, Tabs, Collapse, Space, Checkbox, Alert } from 'antd';
import { 
  PlayCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  StopOutlined
} from '@ant-design/icons';
import { useProjectStore } from '../../store/projectStore';
import './ValidationPanel.css';

const { Panel } = Collapse;

interface ValidationPanelProps {
  onBack: () => void;
}

const ValidationPanel: React.FC<ValidationPanelProps> = ({ onBack }) => {
  const {
    selectedStudy,
    selectedDataset,
    isValidating,
    preflightResults,
    ctResults,
    p21Results,
    runPreflightCheck,
    runCTValidation,
    runP21Validation,
    runAllValidations,
  } = useProjectStore();

  const [selectedChecks, setSelectedChecks] = useState({
    preflight: true,
    ct: true,
    p21: true
  });

  const [stopOnError, setStopOnError] = useState(false);

  const handleRunAll = async () => {
    if (!selectedStudy || !selectedDataset) return;
    await runAllValidations(selectedStudy, selectedDataset);
  };

  const handleRunPreflight = async () => {
    if (!selectedStudy || !selectedDataset) return;
    await runPreflightCheck(selectedStudy, selectedDataset);
  };

  const handleRunCT = async () => {
    if (!selectedStudy || !selectedDataset) return;
    await runCTValidation(selectedStudy, selectedDataset);
  };

  const handleRunP21 = async () => {
    if (!selectedStudy || !selectedDataset) return;
    await runP21Validation(selectedStudy, selectedDataset);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'ERROR':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'WARNING':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      case 'INFO':
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
      default:
        return null;
    }
  };

  const getSeverityTag = (severity: string) => {
    const colors: Record<string, string> = {
      ERROR: 'error',
      WARNING: 'warning',
      INFO: 'processing'
    };
    return <Tag color={colors[severity.toUpperCase()] || 'default'}>{severity}</Tag>;
  };

  const preflightColumns = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => getSeverityTag(severity)
    },
    {
      title: 'Check',
      dataIndex: 'check',
      key: 'check',
      width: 150,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
    },
    {
      title: 'Variable',
      dataIndex: 'variable',
      key: 'variable',
      width: 120,
    },
  ];

  const ctColumns = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => getSeverityTag(severity)
    },
    {
      title: 'Variable',
      dataIndex: 'variable',
      key: 'variable',
      width: 120,
    },
    {
      title: 'Invalid Value',
      dataIndex: 'value',
      key: 'value',
      width: 150,
    },
    {
      title: 'Expected Codelist',
      dataIndex: 'expected_codelist',
      key: 'expected_codelist',
      width: 150,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
    },
  ];

  const p21Columns = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => getSeverityTag(severity)
    },
    {
      title: 'Rule ID',
      dataIndex: 'rule_id',
      key: 'rule_id',
      width: 100,
    },
    {
      title: 'Variable',
      dataIndex: 'variable',
      key: 'variable',
      width: 120,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 150,
    },
  ];

  return (
    <div className="validation-panel">
      <Card
        title={
          <Space>
            <span>Validation Controls</span>
            {selectedStudy && selectedDataset && (
              <Tag color="blue">{selectedStudy} / {selectedDataset}</Tag>
            )}
          </Space>
        }
        extra={
          <Button onClick={onBack}>Back to Dashboard</Button>
        }
      >
        {!selectedStudy || !selectedDataset ? (
          <Alert
            message="No Study/Dataset Selected"
            description="Please select a study and dataset from the dashboard to run validations."
            type="warning"
            showIcon
          />
        ) : (
          <>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* Quick Actions */}
              <Card type="inner" title="Quick Actions">
                <Space wrap>
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={handleRunAll}
                    loading={isValidating}
                    size="large"
                  >
                    Run All Validations
                  </Button>
                  <Button
                    icon={<PlayCircleOutlined />}
                    onClick={handleRunPreflight}
                    loading={isValidating}
                  >
                    Preflight Only
                  </Button>
                  <Button
                    icon={<PlayCircleOutlined />}
                    onClick={handleRunCT}
                    loading={isValidating}
                  >
                    CT Only
                  </Button>
                  <Button
                    icon={<PlayCircleOutlined />}
                    onClick={handleRunP21}
                    loading={isValidating}
                  >
                    P21 Only
                  </Button>
                </Space>

                <div style={{ marginTop: 16 }}>
                  <Checkbox
                    checked={stopOnError}
                    onChange={(e) => setStopOnError(e.target.checked)}
                  >
                    Stop on first error
                  </Checkbox>
                </div>
              </Card>

              {/* Results */}
              <Tabs defaultActiveKey="preflight">
                <Tabs.TabPane
                  tab={
                    <span>
                      {getSeverityIcon(preflightResults?.has_blocking_errors ? 'ERROR' : 'INFO')}
                      Pre-Flight
                    </span>
                  }
                  key="preflight"
                >
                  {preflightResults ? (
                    <>
                      <Alert
                        message={`Runtime: ${preflightResults.runtime_seconds.toFixed(2)}s`}
                        type={preflightResults.passed ? 'success' : 'error'}
                        style={{ marginBottom: 16 }}
                      />
                      <Table
                        columns={preflightColumns}
                        dataSource={preflightResults.issues}
                        rowKey={(record, index) => `preflight-${index}`}
                        size="small"
                        pagination={{ pageSize: 10 }}
                      />
                    </>
                  ) : (
                    <Alert message="No preflight results yet" type="info" />
                  )}
                </Tabs.TabPane>

                <Tabs.TabPane
                  tab={
                    <span>
                      {getSeverityIcon(ctResults?.passed === false ? 'ERROR' : 'INFO')}
                      Controlled Terminology
                    </span>
                  }
                  key="ct"
                >
                  {ctResults ? (
                    <>
                      <Alert
                        message={`Runtime: ${ctResults.runtime_seconds.toFixed(2)}s | Variables Checked: ${ctResults.variables_checked}`}
                        type={ctResults.passed ? 'success' : 'error'}
                        style={{ marginBottom: 16 }}
                      />
                      {ctResults.meddra_version && (
                        <div style={{ marginBottom: 16 }}>
                          <Tag color="purple">MedDRA {ctResults.meddra_version}</Tag>
                          <Tag color="purple">NCI CT {ctResults.nci_ct_version}</Tag>
                        </div>
                      )}
                      <Table
                        columns={ctColumns}
                        dataSource={ctResults.issues}
                        rowKey={(record, index) => `ct-${index}`}
                        size="small"
                        pagination={{ pageSize: 10 }}
                      />
                    </>
                  ) : (
                    <Alert message="No CT validation results yet" type="info" />
                  )}
                </Tabs.TabPane>

                <Tabs.TabPane
                  tab={
                    <span>
                      {getSeverityIcon(p21Results?.passed === false ? 'ERROR' : 'INFO')}
                      P21 Community
                    </span>
                  }
                  key="p21"
                >
                  {p21Results ? (
                    <>
                      <Alert
                        message={`Runtime: ${p21Results.runtime_seconds.toFixed(2)}s`}
                        type={p21Results.passed ? 'success' : 'error'}
                        style={{ marginBottom: 16 }}
                      />
                      {p21Results.summary && (
                        <div style={{ marginBottom: 16 }}>
                          <Tag color="error">Errors: {p21Results.summary.errors}</Tag>
                          <Tag color="warning">Warnings: {p21Results.summary.warnings}</Tag>
                          <Tag color="processing">Info: {p21Results.summary.info}</Tag>
                        </div>
                      )}
                      <Table
                        columns={p21Columns}
                        dataSource={p21Results.issues}
                        rowKey={(record, index) => `p21-${index}`}
                        size="small"
                        pagination={{ pageSize: 10 }}
                      />
                    </>
                  ) : (
                    <Alert message="No P21 validation results yet" type="info" />
                  )}
                </Tabs.TabPane>
              </Tabs>
            </Space>
          </>
        )}
      </Card>
    </div>
  );
};

export default ValidationPanel;
