// @ts-nocheck
/**
 * Testing Tab Component
 *
 * Provides UI for test data generation, test execution, and validation
 * Part of the Test Data Generation & Validation Framework
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Button,
  Form,
  InputNumber,
  Select,
  Space,
  Tabs,
  Alert,
  Table,
  Badge,
  Typography,
  Statistic,
  Row,
  Col,
  message,
  Tag,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  BugOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
import './TestingTab.css';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface TestDataConfig {
  numSubjects: number;
  numHappyPath: number;
  numEdgeCases: number;
  numNegativeCases: number;
  includeDomains: string[];
  seed?: number;
}

interface TestExecution {
  testId: string;
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR';
  duration: number;
  outputPath?: string;
  errors: string[];
  warnings: string[];
}

interface ValidationResult {
  testId: string;
  passed: boolean;
  passRate: number;
  discrepancies: number;
  details: any;
}

export const TestingTab: React.FC = () => {
  const {
    projectConfig,
    consolidatedCode,
    setProjectConfig,
  } = useProjectStore();

  // Use projectConfig.adamDataset as selectedDataset, default to 'ADSL' if not set
  const selectedDataset = projectConfig.adamDataset || 'ADSL';

  // State
  const [activeTab, setActiveTab] = useState<string>('generate');
  const [testDataConfig, setTestDataConfig] = useState<TestDataConfig>({
    numSubjects: 50,
    numHappyPath: 80,
    numEdgeCases: 15,
    numNegativeCases: 5,
    includeDomains: ['DM', 'AE', 'VS', 'LB', 'EX'],
    seed: 12345,
  });
  const [generatedTestDataId, setGeneratedTestDataId] = useState<string | null>(null);
  const [isGeneratingTestData, setIsGeneratingTestData] = useState(false);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testExecution, setTestExecution] = useState<TestExecution | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [testHistory, setTestHistory] = useState<TestExecution[]>([]);

  // Set default dataset if none is selected
  useEffect(() => {
    if (!projectConfig.adamDataset) {
      setProjectConfig({ adamDataset: 'ADSL' });
    }
  }, [projectConfig.adamDataset, setProjectConfig]);

  // ===== TEST DATA GENERATION =====

  const handleGenerateTestData = useCallback(async () => {
    // Ensure dataset is set (should be set by useEffect, but double-check)
    const datasetToUse = selectedDataset || 'ADSL';
    if (!datasetToUse) {
      message.error('Please select a dataset type first');
      return;
    }

    setIsGeneratingTestData(true);

    try {
      const response = await adamApi.generateTestData({
        dataset_type: datasetToUse,
        specification_file: projectConfig.specificationFile || '',
        num_subjects: testDataConfig.numSubjects,
        num_happy_path: testDataConfig.numHappyPath,
        num_edge_cases: testDataConfig.numEdgeCases,
        num_negative_cases: testDataConfig.numNegativeCases,
        include_domains: testDataConfig.includeDomains,
        seed: testDataConfig.seed,
      });

      setGeneratedTestDataId(response.data.test_data_id);

      message.success({
        content: `Test data generated successfully! ${response.data.num_subjects} subjects across ${response.data.datasets.length} domains`,
        duration: 5,
      });

      // Switch to execution tab
      setActiveTab('execute');

    } catch (error: any) {
      console.error('Test data generation failed:', error);
      message.error(`Test data generation failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsGeneratingTestData(false);
    }
  }, [selectedDataset, projectConfig, testDataConfig]);

  // ===== TEST EXECUTION =====

  const handleRunTest = useCallback(async () => {
    if (!generatedTestDataId) {
      message.error('Please generate test data first');
      return;
    }

    if (!consolidatedCode.code) {
      message.error('No ADAM code available to test. Generate code first.');
      return;
    }

    setIsRunningTest(true);

    try {
      const response = await adamApi.runTest({
        test_data_id: generatedTestDataId,
        adam_code: consolidatedCode.code,
        language: projectConfig.programmingLanguage,
        execution_env: 'LOCAL_R', // or 'DOCKER_R' based on user preference
        validation_level: 'STANDARD',
        timeout_seconds: 300,
        enable_logging: true,
      });

      const result: TestExecution = {
        testId: response.data.test_id,
        status: response.data.status,
        duration: response.data.execution_duration_seconds,
        outputPath: response.data.output_dataset_path,
        errors: response.data.errors,
        warnings: response.data.warnings,
      };

      setTestExecution(result);
      setTestHistory(prev => [result, ...prev].slice(0, 10)); // Keep last 10

      if (result.status === 'PASSED') {
        message.success('Test executed successfully!');
        // Auto-switch to validation tab
        setActiveTab('validate');
      } else {
        message.error(`Test execution ${result.status.toLowerCase()}`);
      }

    } catch (error: any) {
      console.error('Test execution failed:', error);
      message.error(`Test execution failed: ${error.response?.data?.detail || error.message}`);
    } finally {
      setIsRunningTest(false);
    }
  }, [generatedTestDataId, consolidatedCode, projectConfig]);

  // ===== TEST VALIDATION =====

  const handleValidateTest = useCallback(async () => {
    if (!testExecution || testExecution.status !== 'PASSED') {
      message.error('Test must complete successfully before validation');
      return;
    }

    try {
      const response = await adamApi.validateTestOutput({
        test_id: testExecution.testId,
        validation_level: 'STANDARD',
      });

      const result: ValidationResult = {
        testId: testExecution.testId,
        passed: response.data.overall_passed,
        passRate: response.data.pass_rate,
        discrepancies: response.data.discrepancy_count,
        details: response.data,
      };

      setValidationResult(result);

      if (result.passed) {
        message.success(`Validation passed! ${result.passRate}% match`);
      } else {
        message.warning(`Validation found ${result.discrepancies} discrepancies`);
      }

    } catch (error: any) {
      console.error('Validation failed:', error);
      message.error(`Validation failed: ${error.response?.data?.detail || error.message}`);
    }
  }, [testExecution]);

  // ===== RENDER =====

  return (
    <div className="testing-tab">
      {/* Header */}
      <Card className="testing-header" bordered={false}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <div className="header-title">
            <BugOutlined className="header-icon" />
            <Title level={3}>Test Data Generation & Validation</Title>
          </div>
          <Paragraph type="secondary">
            Automatically generate test data, execute ADAM code, and validate outputs.
            Catch 80% of bugs before QC review!
          </Paragraph>
        </Space>
      </Card>

      {/* Main Content */}
      <Card className="testing-content" bordered={false}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          {/* TAB 1: GENERATE TEST DATA */}
          <TabPane
            tab={
              <span>
                <FileTextOutlined />
                1. Generate Test Data
              </span>
            }
            key="generate"
          >
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                message="Test Data Generation"
                description="Generate synthetic SDTM datasets with happy path, edge cases, and negative cases for comprehensive testing."
                type="info"
                showIcon
              />

              <Form layout="vertical">
                <Form.Item
                  label="ADAM Dataset Type"
                  tooltip="Select the ADAM dataset type to generate test data for"
                  required
                >
                  <Select
                    value={selectedDataset}
                    onChange={(value) => setProjectConfig({ adamDataset: value })}
                    style={{ width: '100%' }}
                    options={[
                      { label: 'ADSL - Subject Level Analysis Dataset', value: 'ADSL' },
                      { label: 'ADAE - Adverse Events Analysis Dataset', value: 'ADAE' },
                      { label: 'ADLB - Laboratory Analysis Dataset', value: 'ADLB' },
                    ]}
                  />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Number of Test Subjects">
                      <InputNumber
                        min={1}
                        max={1000}
                        value={testDataConfig.numSubjects}
                        onChange={(value) => setTestDataConfig(prev => ({ ...prev, numSubjects: value || 50 }))}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Random Seed (Optional)">
                      <InputNumber
                        placeholder="Leave empty for random"
                        value={testDataConfig.seed}
                        onChange={(value) => setTestDataConfig(prev => ({ ...prev, seed: value || undefined }))}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      label="Happy Path Cases (%)"
                      tooltip="Standard, valid data representing typical scenarios"
                    >
                      <InputNumber
                        min={0}
                        max={100}
                        value={testDataConfig.numHappyPath}
                        onChange={(value) => setTestDataConfig(prev => ({ ...prev, numHappyPath: value || 0 }))}
                        style={{ width: '100%' }}
                        suffix="%"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="Edge Cases (%)"
                      tooltip="Boundary values, nulls, extremes to test robustness"
                    >
                      <InputNumber
                        min={0}
                        max={100}
                        value={testDataConfig.numEdgeCases}
                        onChange={(value) => setTestDataConfig(prev => ({ ...prev, numEdgeCases: value || 0 }))}
                        style={{ width: '100%' }}
                        suffix="%"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label="Negative Cases (%)"
                      tooltip="Invalid data to test error handling"
                    >
                      <InputNumber
                        min={0}
                        max={100}
                        value={testDataConfig.numNegativeCases}
                        onChange={(value) => setTestDataConfig(prev => ({ ...prev, numNegativeCases: value || 0 }))}
                        style={{ width: '100%' }}
                        suffix="%"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label="Include SDTM Domains"
                  tooltip="Select which SDTM domains to generate"
                >
                  <Select
                    mode="multiple"
                    value={testDataConfig.includeDomains}
                    onChange={(value) => setTestDataConfig(prev => ({ ...prev, includeDomains: value }))}
                    options={[
                      { label: 'DM (Demographics)', value: 'DM' },
                      { label: 'AE (Adverse Events)', value: 'AE' },
                      { label: 'VS (Vital Signs)', value: 'VS' },
                      { label: 'LB (Laboratory)', value: 'LB' },
                      { label: 'EX (Exposure)', value: 'EX' },
                    ]}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Form>

              <Button
                type="primary"
                size="large"
                icon={<RocketOutlined />}
                onClick={handleGenerateTestData}
                loading={isGeneratingTestData}
                block
              >
                {isGeneratingTestData ? 'Generating Test Data...' : 'Generate Test Data'}
              </Button>

              {generatedTestDataId && (
                <Alert
                  message="Test Data Generated"
                  description={`Test data ID: ${generatedTestDataId}`}
                  type="success"
                  showIcon
                  action={
                    <Button size="small" onClick={() => setActiveTab('execute')}>
                      Run Test →
                    </Button>
                  }
                />
              )}
            </Space>
          </TabPane>

          {/* TAB 2: EXECUTE TEST */}
          <TabPane
            tab={
              <span>
                <PlayCircleOutlined />
                2. Execute Test
              </span>
            }
            key="execute"
            disabled={!generatedTestDataId}
          >
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {!generatedTestDataId ? (
                <Alert
                  message="No Test Data Available"
                  description="Please generate test data first before executing tests."
                  type="warning"
                  showIcon
                />
              ) : (
                <>
                  <Alert
                    message="Test Execution"
                    description="Run your generated ADAM code against the test data to validate correctness."
                    type="info"
                    showIcon
                  />

                  <Card title="Test Configuration">
                    <Row gutter={16}>
                      <Col span={8}>
                        <Statistic title="Test Data ID" value={generatedTestDataId} />
                      </Col>
                      <Col span={8}>
                        <Statistic title="Language" value={projectConfig.programmingLanguage || 'R'} />
                      </Col>
                      <Col span={8}>
                        <Statistic title="Dataset" value={selectedDataset || 'N/A'} />
                      </Col>
                    </Row>
                  </Card>

                  <Button
                    type="primary"
                    size="large"
                    icon={<PlayCircleOutlined />}
                    onClick={handleRunTest}
                    loading={isRunningTest}
                    disabled={!consolidatedCode.code}
                    block
                  >
                    {isRunningTest ? 'Running Test...' : 'Run Test Execution'}
                  </Button>

                  {!consolidatedCode.code && (
                    <Alert
                      message="No ADAM Code Available"
                      description="Generate consolidated ADAM code before running tests."
                      type="warning"
                      showIcon
                    />
                  )}

                  {testExecution && (
                    <Card
                      title="Test Execution Result"
                      extra={
                        <Badge
                          status={testExecution.status === 'PASSED' ? 'success' : 'error'}
                          text={testExecution.status}
                        />
                      }
                    >
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Row gutter={16}>
                          <Col span={12}>
                            <Statistic
                              title="Execution Time"
                              value={testExecution.duration}
                              suffix="seconds"
                            />
                          </Col>
                          <Col span={12}>
                            <Statistic
                              title="Status"
                              value={testExecution.status}
                              valueStyle={{
                                color: testExecution.status === 'PASSED' ? '#3f8600' : '#cf1322'
                              }}
                            />
                          </Col>
                        </Row>

                        {testExecution.errors.length > 0 && (
                          <Alert
                            message={`${testExecution.errors.length} Error(s)`}
                            description={
                              <ul>
                                {testExecution.errors.map((error, idx) => (
                                  <li key={idx}>{error}</li>
                                ))}
                              </ul>
                            }
                            type="error"
                            showIcon
                          />
                        )}

                        {testExecution.warnings.length > 0 && (
                          <Alert
                            message={`${testExecution.warnings.length} Warning(s)`}
                            description={
                              <ul>
                                {testExecution.warnings.slice(0, 5).map((warning, idx) => (
                                  <li key={idx}>{warning}</li>
                                ))}
                              </ul>
                            }
                            type="warning"
                            showIcon
                            closable
                          />
                        )}

                        {testExecution.status === 'PASSED' && (
                          <Button
                            type="primary"
                            onClick={() => setActiveTab('validate')}
                          >
                            Validate Output →
                          </Button>
                        )}
                      </Space>
                    </Card>
                  )}
                </>
              )}
            </Space>
          </TabPane>

          {/* TAB 3: VALIDATE OUTPUT */}
          <TabPane
            tab={
              <span>
                <CheckCircleOutlined />
                3. Validate Output
              </span>
            }
            key="validate"
            disabled={!testExecution || testExecution.status !== 'PASSED'}
          >
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {testExecution?.status !== 'PASSED' ? (
                <Alert
                  message="Test Must Pass First"
                  description="Test execution must complete successfully before validation."
                  type="warning"
                  showIcon
                />
              ) : (
                <>
                  <Alert
                    message="Output Validation"
                    description="Compare actual output against expected results and check CDISC compliance."
                    type="info"
                    showIcon
                  />

                  <Button
                    type="primary"
                    size="large"
                    icon={<CheckCircleOutlined />}
                    onClick={handleValidateTest}
                    block
                  >
                    Validate Test Output
                  </Button>

                  {validationResult && (
                    <Card
                      title="Validation Result"
                      extra={
                        <Tag color={validationResult.passed ? 'success' : 'error'}>
                          {validationResult.passed ? 'PASSED' : 'FAILED'}
                        </Tag>
                      }
                    >
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Row gutter={16}>
                          <Col span={8}>
                            <Statistic
                              title="Pass Rate"
                              value={validationResult.passRate}
                              suffix="%"
                              valueStyle={{ color: validationResult.passed ? '#3f8600' : '#cf1322' }}
                            />
                          </Col>
                          <Col span={8}>
                            <Statistic
                              title="Discrepancies"
                              value={validationResult.discrepancies}
                              valueStyle={{ color: validationResult.discrepancies === 0 ? '#3f8600' : '#faad14' }}
                            />
                          </Col>
                          <Col span={8}>
                            <Statistic
                              title="Status"
                              value={validationResult.passed ? 'PASSED' : 'FAILED'}
                            />
                          </Col>
                        </Row>

                        {validationResult.discrepancies > 0 && (
                          <Alert
                            message="Validation Discrepancies Found"
                            description="Review the detailed comparison report to identify issues."
                            type="warning"
                            showIcon
                          />
                        )}

                        {validationResult.passed && (
                          <Alert
                            message="✓ All Validation Checks Passed"
                            description="Your ADAM code produces correct output!"
                            type="success"
                            showIcon
                          />
                        )}
                      </Space>
                    </Card>
                  )}
                </>
              )}
            </Space>
          </TabPane>

          {/* TAB 4: TEST HISTORY */}
          <TabPane
            tab={
              <span>
                <FileTextOutlined />
                Test History
              </span>
            }
            key="history"
          >
            <Card title="Test Execution History">
              <Table
                dataSource={testHistory}
                columns={[
                  {
                    title: 'Test ID',
                    dataIndex: 'testId',
                    key: 'testId',
                    render: (id) => <Text code>{id.substring(0, 8)}...</Text>
                  },
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    key: 'status',
                    render: (status) => (
                      <Badge
                        status={status === 'PASSED' ? 'success' : 'error'}
                        text={status}
                      />
                    )
                  },
                  {
                    title: 'Duration',
                    dataIndex: 'duration',
                    key: 'duration',
                    render: (duration) => `${duration.toFixed(2)}s`
                  },
                  {
                    title: 'Errors',
                    dataIndex: 'errors',
                    key: 'errors',
                    render: (errors) => errors.length
                  },
                  {
                    title: 'Warnings',
                    dataIndex: 'warnings',
                    key: 'warnings',
                    render: (warnings) => warnings.length
                  },
                ]}
                pagination={{ pageSize: 10 }}
              />
            </Card>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};
