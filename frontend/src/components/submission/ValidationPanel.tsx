/**
 * Enhanced Validation Panel Component
 *
 * Provides UI for running Pre-P21 structural checks, CT validation, and P21 CE validation
 * with progress tracking, result export, and comprehensive error display
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  Tabs,
  Space,
  Checkbox,
  Alert,
  Tooltip,
  Progress,
  Statistic,
  Row,
  Col,
  Empty,
  Dropdown,
  Input,
  Badge,
  Divider,
  Typography,
  message,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  SearchOutlined,
  ClearOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useProjectStore } from '../../store/projectStore';
import { adamApi } from '../../services/api';
import './ValidationPanel.css';

const { Text, Title } = Typography;
const { Search } = Input;

interface ValidationPanelProps {
  onBack?: () => void;
}

const ValidationPanel: React.FC<ValidationPanelProps> = ({ onBack }) => {
  const {
    projectConfig,
    isValidating,
    preflightResults,
    ctResults,
    p21Results,
    runPreflightCheck,
    runCTValidation,
    runP21Validation,
    runAllValidations,
    clearValidationResults,
  } = useProjectStore();

  const [stopOnError, setStopOnError] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('preflight');

  const studyId = projectConfig.studyId;
  const dataset = projectConfig.adamDataset;

  // Filter issues based on search and severity
  const filterIssues = useCallback((issues: any[]) => {
    if (!issues) return [];
    return issues.filter((issue) => {
      const matchesSearch =
        !searchText ||
        Object.values(issue).some(
          (val) =>
            typeof val === 'string' &&
            val.toLowerCase().includes(searchText.toLowerCase())
        );
      const matchesSeverity =
        severityFilter.length === 0 ||
        severityFilter.includes(issue.severity?.toUpperCase());
      return matchesSearch && matchesSeverity;
    });
  }, [searchText, severityFilter]);

  const filteredPreflightIssues = useMemo(
    () => filterIssues(preflightResults?.issues || []),
    [preflightResults, filterIssues]
  );

  const filteredCTIssues = useMemo(
    () => filterIssues(ctResults?.issues || []),
    [ctResults, filterIssues]
  );

  const filteredP21Issues = useMemo(
    () => filterIssues(p21Results?.issues || []),
    [p21Results, filterIssues]
  );

  const handleRunAll = async () => {
    if (!studyId || !dataset) {
      message.warning('Please configure Study ID and Dataset first');
      return;
    }
    await runAllValidations();
  };

  const handleRunPreflight = async () => {
    if (!studyId || !dataset) {
      message.warning('Please configure Study ID and Dataset first');
      return;
    }
    await runPreflightCheck();
  };

  const handleRunCT = async () => {
    if (!studyId || !dataset) {
      message.warning('Please configure Study ID and Dataset first');
      return;
    }
    await runCTValidation();
  };

  const handleRunP21 = async () => {
    if (!studyId || !dataset) {
      message.warning('Please configure Study ID and Dataset first');
      return;
    }
    await runP21Validation();
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'json' | 'pdf') => {
    if (!studyId || !dataset) return;

    setIsExporting(true);
    try {
      const response = await adamApi.exportValidationResults({
        study_id: studyId,
        dataset: dataset,
        format,
        include_preflight: !!preflightResults,
        include_ct: !!ctResults,
        include_p21: !!p21Results,
      });

      // Create download link
      const blob = new Blob([response.data], {
        type: response.headers['content-type'],
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `validation_results_${studyId}_${dataset}.${format}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      // Remove element IMMEDIATELY and SYNCHRONOUSLY to prevent React conflicts
      try {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        } else if (typeof link.remove === 'function') {
          link.remove();
        }
      } catch (e) {
        // Element may have been auto-removed - ignore
      }
      // Revoke URL after a short delay
      setTimeout(() => {
        try {
          window.URL.revokeObjectURL(url);
        } catch (e) {
          // Ignore
        }
      }, 100);

      message.success(`Validation results exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      message.error('Failed to export validation results');
    } finally {
      setIsExporting(false);
    }
  };

  const getSeverityTag = (severity: string) => {
    const config: Record<string, { color: string; icon: React.ReactNode }> = {
      ERROR: {
        color: 'error',
        icon: <CloseCircleOutlined />,
      },
      WARNING: {
        color: 'warning',
        icon: <WarningOutlined />,
      },
      INFO: {
        color: 'processing',
        icon: <InfoCircleOutlined />,
      },
    };
    const cfg = config[severity?.toUpperCase()] || { color: 'default', icon: null };
    return (
      <Tag color={cfg.color} icon={cfg.icon}>
        {severity}
      </Tag>
    );
  };

  const getResultIcon = (passed: boolean | undefined) => {
    if (passed === undefined) return <InfoCircleOutlined style={{ color: '#8c8c8c' }} />;
    return passed ? (
      <CheckCircleOutlined style={{ color: '#52c41a' }} />
    ) : (
      <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
    );
  };

  const preflightColumns = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      render: (severity: string) => getSeverityTag(severity),
      filters: [
        { text: 'Error', value: 'ERROR' },
        { text: 'Warning', value: 'WARNING' },
        { text: 'Info', value: 'INFO' },
      ],
      onFilter: (value: any, record: any) =>
        record.severity?.toUpperCase() === value,
    },
    {
      title: 'Check Type',
      dataIndex: 'check',
      key: 'check',
      width: 180,
      render: (check: string) => (
        <Text strong style={{ fontSize: '13px' }}>
          {check}
        </Text>
      ),
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      render: (text: string) => (
        <Text style={{ wordBreak: 'break-word' }}>{text}</Text>
      ),
    },
    {
      title: 'Variable',
      dataIndex: 'variable',
      key: 'variable',
      width: 140,
      render: (variable: string) =>
        variable ? <Tag color="blue">{variable}</Tag> : '-',
    },
    {
      title: 'Dataset',
      dataIndex: 'dataset',
      key: 'dataset',
      width: 100,
      render: (ds: string) => ds || dataset,
    },
  ];

  const ctColumns = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      render: (severity: string) => getSeverityTag(severity),
    },
    {
      title: 'Variable',
      dataIndex: 'variable',
      key: 'variable',
      width: 140,
      render: (variable: string) => <Tag color="blue">{variable}</Tag>,
    },
    {
      title: 'Invalid Value',
      dataIndex: 'value',
      key: 'value',
      width: 160,
      render: (value: string) => (
        <Text code style={{ color: '#cf1322' }}>
          {value}
        </Text>
      ),
    },
    {
      title: 'Expected Codelist',
      dataIndex: 'expected_codelist',
      key: 'expected_codelist',
      width: 180,
      render: (codelist: string) => (
        <Tag color="purple">{codelist}</Tag>
      ),
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
      width: 120,
      render: (severity: string) => getSeverityTag(severity),
    },
    {
      title: 'Rule ID',
      dataIndex: 'rule_id',
      key: 'rule_id',
      width: 120,
      render: (ruleId: string) => (
        <Tooltip title="Click to view rule details">
          <Tag
            color="geekblue"
            style={{ cursor: 'pointer' }}
            onClick={() => window.open(`https://wiki.cdisc.org/x/${ruleId}`, '_blank')}
          >
            {ruleId}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Variable',
      dataIndex: 'variable',
      key: 'variable',
      width: 140,
      render: (variable: string) =>
        variable ? <Tag color="blue">{variable}</Tag> : '-',
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      render: (text: string) => (
        <Text style={{ wordBreak: 'break-word' }}>{text}</Text>
      ),
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 160,
      render: (location: string) =>
        location ? <Text type="secondary">{location}</Text> : '-',
    },
  ];

  const exportMenu = {
    items: [
      {
        key: 'csv',
        label: 'Export as CSV',
        icon: <FileTextOutlined />,
        onClick: () => handleExport('csv'),
      },
      {
        key: 'xlsx',
        label: 'Export as Excel',
        icon: <FileExcelOutlined />,
        onClick: () => handleExport('xlsx'),
      },
      {
        key: 'json',
        label: 'Export as JSON',
        icon: <FileTextOutlined />,
        onClick: () => handleExport('json'),
      },
      {
        key: 'pdf',
        label: 'Export as PDF',
        icon: <FilePdfOutlined />,
        onClick: () => handleExport('pdf'),
      },
    ],
  };

  const hasAnyResults = preflightResults || ctResults || p21Results;

  const totalIssues =
    (preflightResults?.issues?.length || 0) +
    (ctResults?.issues?.length || 0) +
    (p21Results?.issues?.length || 0);

  const totalErrors =
    (preflightResults?.issues?.filter((i: any) => i.severity === 'ERROR').length || 0) +
    (ctResults?.issues?.filter((i: any) => i.severity === 'ERROR').length || 0) +
    (p21Results?.issues?.filter((i: any) => i.severity === 'ERROR').length || 0);

  const totalWarnings =
    (preflightResults?.issues?.filter((i: any) => i.severity === 'WARNING').length || 0) +
    (ctResults?.issues?.filter((i: any) => i.severity === 'WARNING').length || 0) +
    (p21Results?.issues?.filter((i: any) => i.severity === 'WARNING').length || 0);

  return (
    <div className="validation-panel">
      {/* Header with Context */}
      <Card
        className="validation-header-card"
        bordered={false}
        style={{ marginBottom: 16 }}
      >
        <Row justify="space-between" align="middle">
          <Col>
            <Space size="large">
              <Title level={4} style={{ margin: 0 }}>
                Validation Suite
              </Title>
              {studyId && dataset && (
                <Space>
                  <Tag color="blue" style={{ fontSize: '14px', padding: '4px 12px' }}>
                    {studyId}
                  </Tag>
                  <Tag color="green" style={{ fontSize: '14px', padding: '4px 12px' }}>
                    {dataset}
                  </Tag>
                </Space>
              )}
            </Space>
          </Col>
          <Col>
            <Space>
              {hasAnyResults && (
                <Dropdown menu={exportMenu} disabled={isExporting}>
                  <Button icon={<DownloadOutlined />} loading={isExporting}>
                    Export Results
                  </Button>
                </Dropdown>
              )}
              {onBack && <Button onClick={onBack}>Back to Dashboard</Button>}
            </Space>
          </Col>
        </Row>
      </Card>

      {!studyId || !dataset ? (
        <Alert
          message="Configuration Required"
          description="Please configure Study ID and ADaM Dataset in the Setup tab before running validations."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      ) : (
        <>
          {/* Summary Statistics */}
          {hasAnyResults && (
            <Card className="validation-summary-card" style={{ marginBottom: 16 }}>
              <Row gutter={24}>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="Total Issues"
                    value={totalIssues}
                    prefix={<InfoCircleOutlined />}
                    valueStyle={{ color: totalIssues > 0 ? '#faad14' : '#52c41a' }}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="Errors"
                    value={totalErrors}
                    prefix={<CloseCircleOutlined />}
                    valueStyle={{ color: totalErrors > 0 ? '#ff4d4f' : '#52c41a' }}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="Warnings"
                    value={totalWarnings}
                    prefix={<WarningOutlined />}
                    valueStyle={{ color: totalWarnings > 0 ? '#faad14' : '#52c41a' }}
                  />
                </Col>
              </Row>
            </Card>
          )}

          {/* Quick Actions */}
          <Card
            title="Validation Controls"
            className="validation-controls-card"
            style={{ marginBottom: 16 }}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Row gutter={[16, 16]} align="middle">
                <Col>
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlayCircleOutlined />}
                    onClick={handleRunAll}
                    loading={isValidating}
                    style={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      height: '48px',
                      fontSize: '16px',
                      fontWeight: 600,
                    }}
                  >
                    Run All Validations
                  </Button>
                </Col>
                <Col>
                  <Space wrap>
                    <Tooltip title="Check file structure, naming conventions, and required variables">
                      <Button
                        icon={<PlayCircleOutlined />}
                        onClick={handleRunPreflight}
                        loading={isValidating}
                      >
                        Pre-P21 Checks
                      </Button>
                    </Tooltip>
                    <Tooltip title="Validate controlled terminology against CDISC codelists">
                      <Button
                        icon={<PlayCircleOutlined />}
                        onClick={handleRunCT}
                        loading={isValidating}
                      >
                        CT Validation
                      </Button>
                    </Tooltip>
                    <Tooltip title="Run Pinnacle 21 Community Edition validation">
                      <Button
                        icon={<PlayCircleOutlined />}
                        onClick={handleRunP21}
                        loading={isValidating}
                      >
                        P21 Validation
                      </Button>
                    </Tooltip>
                  </Space>
                </Col>
                <Col flex="auto" />
                <Col>
                  <Space>
                    <Checkbox
                      checked={stopOnError}
                      onChange={(e) => setStopOnError(e.target.checked)}
                    >
                      Stop on first error
                    </Checkbox>
                    {hasAnyResults && (
                      <Button
                        icon={<ClearOutlined />}
                        onClick={clearValidationResults}
                        danger
                      >
                        Clear Results
                      </Button>
                    )}
                  </Space>
                </Col>
              </Row>

              {isValidating && (
                <div style={{ marginTop: 8 }}>
                  <Progress
                    percent={100}
                    status="active"
                    strokeColor={{
                      from: '#108ee9',
                      to: '#87d068',
                    }}
                    format={() => 'Running validations...'}
                  />
                </div>
              )}
            </Space>
          </Card>

          {/* Filtering Controls */}
          {hasAnyResults && (
            <Card style={{ marginBottom: 16 }}>
              <Row gutter={16} align="middle">
                <Col flex="auto">
                  <Search
                    placeholder="Search in results..."
                    allowClear
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    prefix={<SearchOutlined />}
                    style={{ maxWidth: 400 }}
                  />
                </Col>
                <Col>
                  <Space>
                    <Text type="secondary">Filter by severity:</Text>
                    <Checkbox.Group
                      options={[
                        { label: <Tag color="error">Error</Tag>, value: 'ERROR' },
                        { label: <Tag color="warning">Warning</Tag>, value: 'WARNING' },
                        { label: <Tag color="processing">Info</Tag>, value: 'INFO' },
                      ]}
                      value={severityFilter}
                      onChange={(values) => setSeverityFilter(values as string[])}
                    />
                  </Space>
                </Col>
              </Row>
            </Card>
          )}

          {/* Results Tabs */}
          <Card className="validation-results-card">
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              type="card"
              items={[
                {
                  key: 'preflight',
                  label: (
                    <Badge
                      count={preflightResults?.issues?.length || 0}
                      size="small"
                      offset={[10, 0]}
                      style={{
                        backgroundColor:
                          preflightResults?.has_blocking_errors ? '#ff4d4f' : '#52c41a',
                      }}
                    >
                      <Space>
                        {getResultIcon(preflightResults?.passed)}
                        Pre-P21 Checks
                      </Space>
                    </Badge>
                  ),
                  children: preflightResults ? (
                    <div>
                      <Alert
                        message={
                          <Space>
                            <ClockCircleOutlined />
                            <Text>
                              Runtime: {preflightResults.runtime_seconds?.toFixed(2)}s
                            </Text>
                            <Divider type="vertical" />
                            <Text>
                              Status:{' '}
                              {preflightResults.passed ? (
                                <Text type="success" strong>
                                  PASSED
                                </Text>
                              ) : (
                                <Text type="danger" strong>
                                  FAILED
                                </Text>
                              )}
                            </Text>
                          </Space>
                        }
                        type={preflightResults.passed ? 'success' : 'error'}
                        style={{ marginBottom: 16 }}
                      />
                      <Table
                        columns={preflightColumns}
                        dataSource={filteredPreflightIssues}
                        rowKey={(_record, index) => `preflight-${index}`}
                        size="small"
                        pagination={{
                          pageSize: 10,
                          showSizeChanger: true,
                          showTotal: (total, range) =>
                            `${range[0]}-${range[1]} of ${total} issues`,
                        }}
                        locale={{
                          emptyText: (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description="No issues found - All checks passed!"
                            />
                          ),
                        }}
                      />
                    </div>
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="No Pre-P21 results yet"
                    >
                      <Button
                        type="primary"
                        onClick={handleRunPreflight}
                        loading={isValidating}
                      >
                        Run Pre-P21 Checks
                      </Button>
                    </Empty>
                  ),
                },
                {
                  key: 'ct',
                  label: (
                    <Badge
                      count={ctResults?.issues?.length || 0}
                      size="small"
                      offset={[10, 0]}
                      style={{
                        backgroundColor: ctResults?.passed === false ? '#ff4d4f' : '#52c41a',
                      }}
                    >
                      <Space>
                        {getResultIcon(ctResults?.passed)}
                        Controlled Terminology
                      </Space>
                    </Badge>
                  ),
                  children: ctResults ? (
                    <div>
                      <Alert
                        message={
                          <Space split={<Divider type="vertical" />}>
                            <Text>
                              <ClockCircleOutlined /> Runtime:{' '}
                              {ctResults.runtime_seconds?.toFixed(2)}s
                            </Text>
                            <Text>Variables Checked: {ctResults.variables_checked}</Text>
                            <Text>
                              Status:{' '}
                              {ctResults.passed ? (
                                <Text type="success" strong>
                                  PASSED
                                </Text>
                              ) : (
                                <Text type="danger" strong>
                                  FAILED
                                </Text>
                              )}
                            </Text>
                          </Space>
                        }
                        type={ctResults.passed ? 'success' : 'error'}
                        style={{ marginBottom: 16 }}
                      />
                      {(ctResults.meddra_version || ctResults.nci_ct_version) && (
                        <div style={{ marginBottom: 16 }}>
                          <Text type="secondary" style={{ marginRight: 8 }}>
                            CT Versions:
                          </Text>
                          {ctResults.meddra_version && (
                            <Tag color="purple">MedDRA {ctResults.meddra_version}</Tag>
                          )}
                          {ctResults.nci_ct_version && (
                            <Tag color="purple">NCI CT {ctResults.nci_ct_version}</Tag>
                          )}
                        </div>
                      )}
                      <Table
                        columns={ctColumns}
                        dataSource={filteredCTIssues}
                        rowKey={(_record, index) => `ct-${index}`}
                        size="small"
                        pagination={{
                          pageSize: 10,
                          showSizeChanger: true,
                          showTotal: (total, range) =>
                            `${range[0]}-${range[1]} of ${total} issues`,
                        }}
                        locale={{
                          emptyText: (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description="No CT violations found!"
                            />
                          ),
                        }}
                      />
                    </div>
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="No CT validation results yet"
                    >
                      <Button type="primary" onClick={handleRunCT} loading={isValidating}>
                        Run CT Validation
                      </Button>
                    </Empty>
                  ),
                },
                {
                  key: 'p21',
                  label: (
                    <Badge
                      count={p21Results?.issues?.length || 0}
                      size="small"
                      offset={[10, 0]}
                      style={{
                        backgroundColor: p21Results?.passed === false ? '#ff4d4f' : '#52c41a',
                      }}
                    >
                      <Space>
                        {getResultIcon(p21Results?.passed)}
                        P21 Community
                      </Space>
                    </Badge>
                  ),
                  children: p21Results ? (
                    <div>
                      <Alert
                        message={
                          <Space split={<Divider type="vertical" />}>
                            <Text>
                              <ClockCircleOutlined /> Runtime:{' '}
                              {p21Results.runtime_seconds?.toFixed(2)}s
                            </Text>
                            <Text>
                              Status:{' '}
                              {p21Results.passed ? (
                                <Text type="success" strong>
                                  PASSED
                                </Text>
                              ) : (
                                <Text type="danger" strong>
                                  FAILED
                                </Text>
                              )}
                            </Text>
                          </Space>
                        }
                        type={p21Results.passed ? 'success' : 'error'}
                        style={{ marginBottom: 16 }}
                      />
                      {p21Results.summary && (
                        <Row gutter={16} style={{ marginBottom: 16 }}>
                          <Col>
                            <Tag color="error" style={{ fontSize: '14px', padding: '4px 12px' }}>
                              Errors: {p21Results.summary.errors || 0}
                            </Tag>
                          </Col>
                          <Col>
                            <Tag color="warning" style={{ fontSize: '14px', padding: '4px 12px' }}>
                              Warnings: {p21Results.summary.warnings || 0}
                            </Tag>
                          </Col>
                          <Col>
                            <Tag color="processing" style={{ fontSize: '14px', padding: '4px 12px' }}>
                              Info: {p21Results.summary.info || 0}
                            </Tag>
                          </Col>
                          {p21Results.report_path && (
                            <Col>
                              <Button
                                size="small"
                                icon={<DownloadOutlined />}
                                onClick={() =>
                                  window.open(p21Results.report_path, '_blank')
                                }
                              >
                                View Full Report
                              </Button>
                            </Col>
                          )}
                        </Row>
                      )}
                      <Table
                        columns={p21Columns}
                        dataSource={filteredP21Issues}
                        rowKey={(_record, index) => `p21-${index}`}
                        size="small"
                        pagination={{
                          pageSize: 10,
                          showSizeChanger: true,
                          showTotal: (total, range) =>
                            `${range[0]}-${range[1]} of ${total} issues`,
                        }}
                        locale={{
                          emptyText: (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description="No P21 issues found!"
                            />
                          ),
                        }}
                      />
                    </div>
                  ) : (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="No P21 validation results yet"
                    >
                      <Button type="primary" onClick={handleRunP21} loading={isValidating}>
                        Run P21 Validation
                      </Button>
                    </Empty>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default ValidationPanel;
