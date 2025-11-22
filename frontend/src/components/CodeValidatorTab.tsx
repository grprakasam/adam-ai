import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Tag,
  Alert,
  Spin,
  Tooltip,
  Select,
  Checkbox,
  List,
  Tabs,
  Typography,
  Progress,
  Empty,
  message,
  Badge,
  Radio,
  Statistic,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  CodeOutlined,
  SettingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
import { DatasetUploadModal } from './DatasetUploadModal';
import { DatasetSelector } from './DatasetSelector';
import './CodeValidatorTab.css';

const { Text, Title } = Typography;
const { Option } = Select;

interface SnippetItem {
  id: string;
  name: string;
  category: string;
  language: 'R' | 'SAS';
  code: string;
}

interface ExecutionResult {
  snippet_id: string;
  status: 'passed' | 'failed' | 'error';
  language: 'R' | 'SAS';
  console_output: string[];
  errors: string[];
  warnings: string[];
  performance: {
    execution_time_seconds: number;
  };
  executed_at: string;
}

export const CodeValidatorTab: React.FC = () => {
  const {
    pairProgramming,
    programmingLanguage,
    categorizedVariables,
  } = useProjectStore();

  // State
  const [activeLanguage, setActiveLanguage] = useState<'R' | 'SAS'>(programmingLanguage);
  const [selectedSnippets, setSelectedSnippets] = useState<string[]>([]);
  const [currentSnippet, setCurrentSnippet] = useState<SnippetItem | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [timeout, setTimeout] = useState<number>(60);
  const [dockerStatus, setDockerStatus] = useState<any>(null);
  const [checkingDocker, setCheckingDocker] = useState(true);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [datasetRefreshTrigger, setDatasetRefreshTrigger] = useState(0);

  // Build snippet list from approved pair programming snippets
  // Approved if: has code AND (not marked as 'modify' OR explicitly accepted)
  const availableSnippets: SnippetItem[] = Object.values(pairProgramming?.snippets || {})
    .filter((snippet: any) => {
      return !!snippet.codeSnippet && !snippet.error && snippet.accepted !== 'modify';
    })
    .map((snippet: any) => {
      const varInfo = categorizedVariables?.categories
        ?.flatMap(c => c.variables)
        .find(v => v.name === snippet.variable);
      
      return {
        id: snippet.variable,
        name: snippet.variable,
        category: varInfo?.category || 'Other',
        language: programmingLanguage,
        code: snippet.codeSnippet,
      };
    });

  // Check Docker environment on mount
  useEffect(() => {
    checkDockerEnvironment();
  }, []);

  const checkDockerEnvironment = async () => {
    setCheckingDocker(true);
    try {
      const status = await adamApi.checkDockerEnvironment();
      setDockerStatus(status);
    } catch (error) {
      message.error('Failed to check Docker environment');
    } finally {
      setCheckingDocker(false);
    }
  };

  const handleSnippetSelect = (snippetId: string) => {
    const snippet = availableSnippets.find(s => s.id === snippetId);
    if (snippet) {
      setCurrentSnippet(snippet);
      setExecutionResult(null);
    }
  };

  const handleQuickCheck = async () => {
    if (!currentSnippet) return;

    try {
      message.info('Running syntax check...');
      // Call validation endpoint (reuse existing validation)
      const result = await adamApi.validateCode({
        code: currentSnippet.code,
        language: currentSnippet.language,
      });
      
      if (result.errors.length === 0) {
        message.success('✓ No syntax errors found');
      } else {
        message.warning(`Found ${result.errors.length} syntax issues`);
      }
    } catch (error) {
      message.error('Syntax check failed');
    }
  };

  const handleExecute = async () => {
    if (!currentSnippet) return;

    if (!dockerStatus?.docker_available) {
      message.error('Docker is not available. Please start Docker Desktop.');
      return;
    }

    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const result = await adamApi.executeCodeSnippet({
        code: currentSnippet.code,
        language: currentSnippet.language,
        snippet_id: currentSnippet.id,
        test_dataset_ids: selectedDatasetId ? [selectedDatasetId] : [],
        timeout: timeout,
        execution_env: 'docker',
      });

      setExecutionResult(result);

      if (result.status === 'passed') {
        message.success(`✓ Execution completed in ${result.performance.execution_time_seconds.toFixed(2)}s`);
      } else {
        message.error('Execution failed');
      }
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Execution failed');
      setExecutionResult({
        snippet_id: currentSnippet.id,
        status: 'error',
        language: currentSnippet.language,
        console_output: [],
        errors: [error.response?.data?.detail || error.message || 'Unknown error'],
        warnings: [],
        performance: { execution_time_seconds: 0 },
        executed_at: new Date().toISOString(),
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const getStatusIcon = () => {
    if (!executionResult) return null;
    if (executionResult.status === 'passed') return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />;
    if (executionResult.status === 'failed') return <CloseCircleOutlined style={{ color: '#faad14', fontSize: 24 }} />;
    return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 24 }} />;
  };

  const getStatusColor = (status: string) => {
    if (status === 'passed') return 'success';
    if (status === 'failed') return 'warning';
    return 'error';
  };

  return (
    <div className="code-validator-container">
      {/* Header */}
      <Card className="validator-header" bordered={false}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space size="large">
              <div className="header-title">
                <CodeOutlined className="title-icon" />
                <Title level={3} style={{ margin: 0 }}>Code Validator</Title>
              </div>
              <Radio.Group value={activeLanguage} onChange={(e) => setActiveLanguage(e.target.value)}>
                <Radio.Button value="R">R</Radio.Button>
                <Radio.Button value="SAS">SAS</Radio.Button>
              </Radio.Group>
            </Space>
          </Col>
          <Col>
            {checkingDocker ? (
              <Spin size="small" />
            ) : dockerStatus?.docker_available ? (
              <Space>
                <Badge status="success" />
                <Text type="secondary">Docker Ready</Text>
                <Tooltip title="Refresh status">
                  <Button
                    type="text"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={checkDockerEnvironment}
                  />
                </Tooltip>
              </Space>
            ) : (
              <Space>
                <Badge status="error" />
                <Text type="danger">Docker Unavailable</Text>
                <Tooltip title="Check Docker">
                  <Button
                    type="text"
                    size="small"
                    icon={<SettingOutlined />}
                    onClick={checkDockerEnvironment}
                  />
                </Tooltip>
              </Space>
            )}
          </Col>
        </Row>
      </Card>

      {/* Main Content */}
      <Row gutter={[16, 16]}>
        {/* Left: Dataset Selector & Snippet Selector */}
        <Col xs={24} md={8} lg={6}>
          {/* Dataset Selector */}
          <DatasetSelector
            selectedDatasetId={selectedDatasetId}
            onSelectDataset={setSelectedDatasetId}
            onOpenUploadModal={() => setUploadModalVisible(true)}
            refreshTrigger={datasetRefreshTrigger}
          />

          <div style={{ marginTop: 16 }} />

          {/* Snippet Selector */}
          <Card
            title={
              <Space>
                <DatabaseOutlined />
                <span>Select Snippets</span>
                <Badge count={availableSnippets.length} showZero />
              </Space>
            }
            className="snippet-selector"
          >
            {availableSnippets.length === 0 ? (
              <Empty
                description="No approved snippets"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <List
                size="small"
                dataSource={availableSnippets}
                renderItem={(snippet) => (
                  <List.Item
                    key={snippet.id}
                    className={currentSnippet?.id === snippet.id ? 'snippet-item-active' : 'snippet-item'}
                    onClick={() => handleSnippetSelect(snippet.id)}
                    style={{ cursor: 'pointer', padding: '8px 12px' }}
                  >
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Space>
                        <Checkbox
                          checked={selectedSnippets.includes(snippet.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSnippets([...selectedSnippets, snippet.id]);
                            } else {
                              setSelectedSnippets(selectedSnippets.filter(id => id !== snippet.id));
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Text strong>{snippet.name}</Text>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12, marginLeft: 24 }}>
                        {snippet.category}
                      </Text>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Middle & Right: Editor and Results */}
        <Col xs={24} md={16} lg={18}>
          {!currentSnippet ? (
            <Card>
              <Empty
                description="Select a snippet to validate"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </Card>
          ) : (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {/* Code Editor */}
              <Card
                title={
                  <Space>
                    <Tag color="blue">{currentSnippet.language}</Tag>
                    <Text strong>{currentSnippet.name}</Text>
                    <Text type="secondary">- {currentSnippet.category}</Text>
                  </Space>
                }
                extra={
                  <Space>
                    <Select
                      value={timeout}
                      onChange={setTimeout}
                      style={{ width: 120 }}
                      size="small"
                    >
                      <Option value={30}>30s</Option>
                      <Option value={60}>1 min</Option>
                      <Option value={300}>5 min</Option>
                    </Select>
                    <Tooltip title="Quick syntax check">
                      <Button
                        icon={<ThunderboltOutlined />}
                        onClick={handleQuickCheck}
                        size="small"
                      >
                        Quick Check
                      </Button>
                    </Tooltip>
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      onClick={handleExecute}
                      loading={isExecuting}
                      disabled={!dockerStatus?.docker_available}
                    >
                      Execute
                    </Button>
                  </Space>
                }
              >
                <Editor
                  height="400px"
                  language={currentSnippet.language.toLowerCase()}
                  value={currentSnippet.code}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                  }}
                />
              </Card>

              {/* Execution Results */}
              {isExecuting && (
                <Card>
                  <Space direction="vertical" align="center" style={{ width: '100%' }}>
                    <Spin size="large" />
                    <Text>Executing code in Docker container...</Text>
                    <Progress percent={50} showInfo={false} status="active" />
                  </Space>
                </Card>
              )}

              {executionResult && !isExecuting && (
                <Card
                  title={
                    <Space>
                      {getStatusIcon()}
                      <span>Execution Result</span>
                      <Tag color={getStatusColor(executionResult.status)}>
                        {executionResult.status.toUpperCase()}
                      </Tag>
                      <Tag icon={<ClockCircleOutlined />}>
                        {executionResult.performance.execution_time_seconds.toFixed(2)}s
                      </Tag>
                    </Space>
                  }
                >
                  <Tabs defaultActiveKey="console">
                    <Tabs.TabPane tab="Console Output" key="console">
                      <div className="console-output">
                        {executionResult.console_output.length > 0 ? (
                          executionResult.console_output.map((line, idx) => (
                            <div key={idx} className="console-line">{line}</div>
                          ))
                        ) : (
                          <Text type="secondary">No console output</Text>
                        )}
                      </div>
                    </Tabs.TabPane>

                    <Tabs.TabPane 
                      tab={
                        <Badge count={executionResult.errors.length} offset={[10, 0]}>
                          <span>Errors</span>
                        </Badge>
                      } 
                      key="errors"
                    >
                      {executionResult.errors.length > 0 ? (
                        <List
                          dataSource={executionResult.errors}
                          renderItem={(error, idx) => (
                            <List.Item key={idx}>
                              <Alert
                                type="error"
                                message={error}
                                showIcon
                                style={{ width: '100%' }}
                              />
                            </List.Item>
                          )}
                        />
                      ) : (
                        <Empty description="No errors" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </Tabs.TabPane>

                    <Tabs.TabPane 
                      tab={
                        <Badge count={executionResult.warnings.length} offset={[10, 0]}>
                          <span>Warnings</span>
                        </Badge>
                      } 
                      key="warnings"
                    >
                      {executionResult.warnings.length > 0 ? (
                        <List
                          dataSource={executionResult.warnings}
                          renderItem={(warning, idx) => (
                            <List.Item key={idx}>
                              <Alert
                                type="warning"
                                message={warning}
                                showIcon
                                style={{ width: '100%' }}
                              />
                            </List.Item>
                          )}
                        />
                      ) : (
                        <Empty description="No warnings" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="Performance" key="performance">
                      <Row gutter={16}>
                        <Col span={8}>
                          <Card>
                            <Statistic
                              title="Execution Time"
                              value={executionResult.performance.execution_time_seconds}
                              suffix="s"
                              precision={2}
                            />
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card>
                            <Statistic
                              title="Status"
                              value={executionResult.status.toUpperCase()}
                              valueStyle={{ color: executionResult.status === 'passed' ? '#3f8600' : '#cf1322' }}
                            />
                          </Card>
                        </Col>
                        <Col span={8}>
                          <Card>
                            <Statistic
                              title="Executed At"
                              value={new Date(executionResult.executed_at).toLocaleTimeString()}
                            />
                          </Card>
                        </Col>
                      </Row>
                    </Tabs.TabPane>
                  </Tabs>
                </Card>
              )}
            </Space>
          )}
        </Col>
      </Row>

      {/* Dataset Upload Modal */}
      <DatasetUploadModal
        visible={uploadModalVisible}
        onClose={() => setUploadModalVisible(false)}
        onSuccess={() => {
          setDatasetRefreshTrigger(prev => prev + 1);
          message.success('Dataset uploaded successfully!');
        }}
      />
    </div>
  );
};
