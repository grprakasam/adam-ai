import React, { useState, useEffect } from 'react';
import { Card, Button, Alert, Progress, Table, Tag, Spin, Modal, Select, Checkbox, Space, Divider, Statistic, Row, Col } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  DownloadOutlined,
  SyncOutlined,
  DockerOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { api } from '../services/api';
import './P21ValidationPanel.css';

interface DockerStatus {
  docker_available: boolean;
  docker_version?: string;
  p21_image_available: boolean;
  p21_image_version?: string;
  error?: string;
}

interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: 'error' | 'warning' | 'info';
}

interface ValidationResult {
  rule_id: string;
  rule_name: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  variable?: string;
  record_count?: number;
  details?: string;
}

interface P21ValidationPanelProps {
  studyId: string;
  dataset: string;
  datasetPaths?: string[];
}

export const P21ValidationPanel: React.FC<P21ValidationPanelProps> = ({
  studyId,
  dataset,
  datasetPaths = []
}) => {
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [pullingImages, setPullingImages] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [availableRules, setAvailableRules] = useState<ValidationRule[]>([]);
  const [selectedRules, setSelectedRules] = useState<string[]>([]);
  const [showRuleSelector, setShowRuleSelector] = useState(false);

  useEffect(() => {
    checkDockerStatus();
    loadAvailableRules();
  }, []);

  const checkDockerStatus = async () => {
    setLoadingStatus(true);
    try {
      const response = await api.get('/api/v1/code-execution/environment-status');
      setDockerStatus(response.data);
    } catch (error) {
      console.error('Failed to check Docker status:', error);
      setDockerStatus({
        docker_available: false,
        p21_image_available: false,
        error: 'Failed to connect to Docker service'
      });
    } finally {
      setLoadingStatus(false);
    }
  };

  const loadAvailableRules = async () => {
    try {
      const response = await api.get('/api/v1/rules/list');
      setAvailableRules(response.data.rules || []);
    } catch (error) {
      console.error('Failed to load validation rules:', error);
    }
  };

  const handlePullImages = async () => {
    setPullingImages(true);
    try {
      await api.post('/api/v1/code-execution/pull-images');
      Modal.success({
        title: 'Images Pulled Successfully',
        content: 'P21 Community Edition Docker image has been pulled successfully.'
      });
      await checkDockerStatus();
    } catch (error: any) {
      Modal.error({
        title: 'Failed to Pull Images',
        content: error.response?.data?.detail || 'An error occurred while pulling Docker images.'
      });
    } finally {
      setPullingImages(false);
    }
  };

  const handleRunValidation = async () => {
    if (!dockerStatus?.docker_available) {
      Modal.warning({
        title: 'Docker Not Available',
        content: 'Docker is not running or not installed. Please start Docker and try again.'
      });
      return;
    }

    if (!dockerStatus?.p21_image_available) {
      Modal.warning({
        title: 'P21 Image Not Available',
        content: 'P21 Community Edition Docker image is not available. Please pull the image first.'
      });
      return;
    }

    setRunning(true);
    setProgress(0);
    setResults([]);

    try {
      const response = await api.post('/api/v1/validation/p21', {
        study_id: studyId,
        dataset: dataset,
        dataset_paths: datasetPaths.length > 0 ? datasetPaths : undefined,
        rules: selectedRules.length > 0 ? selectedRules : undefined,
        timeout: 600000 // 10 minutes
      });

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 1000);

      setProgress(100);
      setResults(response.data.results || []);

      Modal.success({
        title: 'Validation Complete',
        content: `Found ${response.data.results?.length || 0} validation findings.`
      });
    } catch (error: any) {
      Modal.error({
        title: 'Validation Failed',
        content: error.response?.data?.detail || 'An error occurred during P21 validation.'
      });
    } finally {
      setRunning(false);
    }
  };

  const handleExportResults = async () => {
    try {
      const response = await api.post(
        '/api/v1/validation/export',
        {
          study_id: studyId,
          dataset: dataset,
          format: 'xlsx',
          include_p21: true
        },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${studyId}_${dataset}_P21_Validation.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      Modal.error({
        title: 'Export Failed',
        content: error.response?.data?.detail || 'Failed to export validation results.'
      });
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'warning':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      case 'info':
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
      default:
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'processing';
      default:
        return 'success';
    }
  };

  const columns = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity: string) => (
        <Tag icon={getSeverityIcon(severity)} color={getSeverityColor(severity)}>
          {severity.toUpperCase()}
        </Tag>
      ),
      filters: [
        { text: 'Error', value: 'error' },
        { text: 'Warning', value: 'warning' },
        { text: 'Info', value: 'info' }
      ],
      onFilter: (value: any, record: ValidationResult) => record.severity === value
    },
    {
      title: 'Rule',
      dataIndex: 'rule_name',
      key: 'rule_name',
      width: 200
    },
    {
      title: 'Variable',
      dataIndex: 'variable',
      key: 'variable',
      width: 120
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true
    },
    {
      title: 'Records',
      dataIndex: 'record_count',
      key: 'record_count',
      width: 100,
      align: 'right' as const
    }
  ];

  const errorCount = results.filter(r => r.severity === 'error').length;
  const warningCount = results.filter(r => r.severity === 'warning').length;
  const infoCount = results.filter(r => r.severity === 'info').length;

  return (
    <div className="p21-validation-panel">
      <Card
        title={
          <Space>
            <DockerOutlined />
            P21 Community Edition Validation
          </Space>
        }
        extra={
          <Button
            icon={<SyncOutlined />}
            onClick={checkDockerStatus}
            loading={loadingStatus}
          >
            Refresh Status
          </Button>
        }
      >
        {/* Docker Status */}
        <div className="docker-status-section">
          <h4>Docker Environment</h4>
          {loadingStatus ? (
            <Spin />
          ) : dockerStatus ? (
            <>
              <Alert
                type={dockerStatus.docker_available ? 'success' : 'error'}
                message={
                  dockerStatus.docker_available
                    ? `Docker is running (Version: ${dockerStatus.docker_version || 'Unknown'})`
                    : 'Docker is not available'
                }
                description={dockerStatus.error}
                showIcon
                style={{ marginBottom: 16 }}
              />

              {dockerStatus.docker_available && (
                <Alert
                  type={dockerStatus.p21_image_available ? 'success' : 'warning'}
                  message={
                    dockerStatus.p21_image_available
                      ? `P21 CE Image Ready (Version: ${dockerStatus.p21_image_version || 'Latest'})`
                      : 'P21 CE Docker image not found'
                  }
                  description={
                    !dockerStatus.p21_image_available &&
                    'Click "Pull P21 Images" to download the P21 Community Edition Docker image.'
                  }
                  showIcon
                  action={
                    !dockerStatus.p21_image_available && (
                      <Button
                        type="primary"
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={handlePullImages}
                        loading={pullingImages}
                      >
                        Pull P21 Images
                      </Button>
                    )
                  }
                  style={{ marginBottom: 16 }}
                />
              )}
            </>
          ) : (
            <Alert
              type="error"
              message="Failed to check Docker status"
              showIcon
            />
          )}
        </div>

        <Divider />

        {/* Validation Controls */}
        <div className="validation-controls">
          <h4>Run Validation</h4>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              type="info"
              message="Dataset Information"
              description={
                <>
                  <div><strong>Study:</strong> {studyId}</div>
                  <div><strong>Dataset:</strong> {dataset}</div>
                  {datasetPaths.length > 0 && (
                    <div><strong>Files:</strong> {datasetPaths.length} dataset(s)</div>
                  )}
                </>
              }
              showIcon
            />

            <Space>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleRunValidation}
                loading={running}
                disabled={!dockerStatus?.docker_available || !dockerStatus?.p21_image_available}
                size="large"
              >
                Run P21 Validation
              </Button>

              <Button
                icon={<FileTextOutlined />}
                onClick={() => setShowRuleSelector(true)}
              >
                Select Rules ({selectedRules.length > 0 ? selectedRules.length : 'All'})
              </Button>
            </Space>

            {running && (
              <div>
                <Progress percent={progress} status="active" />
                <div style={{ textAlign: 'center', marginTop: 8, color: '#8c8c8c' }}>
                  Running P21 validation... This may take several minutes.
                </div>
              </div>
            )}
          </Space>
        </div>

        {/* Results Summary */}
        {results.length > 0 && (
          <>
            <Divider />
            <div className="validation-summary">
              <h4>Validation Summary</h4>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic
                    title="Total Findings"
                    value={results.length}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Errors"
                    value={errorCount}
                    valueStyle={{ color: '#ff4d4f' }}
                    prefix={<CloseCircleOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Warnings"
                    value={warningCount}
                    valueStyle={{ color: '#faad14' }}
                    prefix={<WarningOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Info"
                    value={infoCount}
                    valueStyle={{ color: '#1890ff' }}
                    prefix={<InfoCircleOutlined />}
                  />
                </Col>
              </Row>

              <Button
                icon={<DownloadOutlined />}
                onClick={handleExportResults}
                style={{ marginTop: 16 }}
              >
                Export Results (Excel)
              </Button>
            </div>

            <Divider />

            {/* Results Table */}
            <div className="validation-results">
              <h4>Validation Findings</h4>
              <Table
                columns={columns}
                dataSource={results}
                rowKey={(record, index) => `${record.rule_id}-${index}`}
                pagination={{ pageSize: 20 }}
                scroll={{ x: 800 }}
              />
            </div>
          </>
        )}
      </Card>

      {/* Rule Selector Modal */}
      <Modal
        title="Select Validation Rules"
        open={showRuleSelector}
        onOk={() => setShowRuleSelector(false)}
        onCancel={() => setShowRuleSelector(false)}
        width={700}
      >
        <Alert
          type="info"
          message="Select specific rules to run, or leave empty to run all available rules."
          style={{ marginBottom: 16 }}
          showIcon
        />
        <Checkbox.Group
          style={{ width: '100%' }}
          value={selectedRules}
          onChange={(values) => setSelectedRules(values as string[])}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {availableRules.map(rule => (
              <Card key={rule.id} size="small">
                <Checkbox value={rule.id}>
                  <strong>{rule.name}</strong>
                  <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                    {rule.description}
                  </div>
                  <Tag color={getSeverityColor(rule.severity)} style={{ marginTop: 4 }}>
                    {rule.severity}
                  </Tag>
                </Checkbox>
              </Card>
            ))}
          </Space>
        </Checkbox.Group>
      </Modal>
    </div>
  );
};
