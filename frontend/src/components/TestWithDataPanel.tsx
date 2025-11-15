/**
 * Test With Data Panel
 * 
 * Generates mock SDTM datasets for testing ADAM programs.
 * Allows users to specify parameters, preview data, and download in multiple formats.
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Table,
  Alert,
  Space,
  Slider,
  Radio,
  Tag,
  Statistic,
  Row,
  Col,
  Typography,
  Spin,
  message,
  Divider,
  Tooltip,
} from 'antd';
import {
  DownloadOutlined,
  ReloadOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import './TestWithDataPanel.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface SDTMGenerationParams {
  domain: string;
  num_subjects: number;
  records_per_subject?: number;
  missingness_pct: number;
  distribution_type: 'uniform' | 'normal' | 'realistic';
  study_start_date: string;
  study_end_date: string;
  template_source: 'pharmaverse' | 'cdisc' | 'custom';
}

interface Domain {
  code: string;
  name: string;
  description: string;
  variables_count: number;
  supports_multiple_records: boolean;
}

interface TestWithDataPanelProps {
  standalone?: boolean;
}

export const TestWithDataPanel: React.FC<TestWithDataPanelProps> = ({ standalone = false }) => {
  const [form] = Form.useForm();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [parameters, setParameters] = useState<SDTMGenerationParams>({
    domain: 'DM',
    num_subjects: 50,
    missingness_pct: 10,
    distribution_type: 'realistic',
    study_start_date: '2024-01-01',
    study_end_date: '2024-12-31',
    template_source: 'pharmaverse',
  });
  const [generatedData, setGeneratedData] = useState<any[] | null>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingDomains, setLoadingDomains] = useState(true);

  // Load supported domains on mount
  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    try {
      setLoadingDomains(true);
      const response = await fetch('/api/v1/test-data/domains');
      const data = await response.json();
      setDomains(data.domains);
      if (data.domains.length > 0) {
        setSelectedDomain(data.domains[0]);
      }
    } catch (error) {
      message.error('Failed to load supported domains');
      console.error('Error loading domains:', error);
    } finally {
      setLoadingDomains(false);
    }
  };

  const handleDomainChange = (domainCode: string) => {
    const domain = domains.find(d => d.code === domainCode);
    setSelectedDomain(domain || null);
    setParameters({ ...parameters, domain: domainCode });
    
    // Reset records_per_subject based on domain
    if (domain?.supports_multiple_records && !parameters.records_per_subject) {
      setParameters({ ...parameters, domain: domainCode, records_per_subject: 5 });
      form.setFieldValue('records_per_subject', 5);
    }
  };

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      message.loading({ content: 'Generating SDTM data...', key: 'generate', duration: 0 });

      const response = await fetch('/api/v1/test-data/generate-sdtm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parameters),
      });

      const data = await response.json();

      if (data.status === 'success') {
        setGeneratedData(data.preview_data);
        setStatistics(data.data);
        setValidationResults(data.validation_results);
        message.success({
          content: `Successfully generated ${data.data.total_rows} rows`,
          key: 'generate',
          duration: 3,
        });
      } else {
        throw new Error(data.message || 'Failed to generate data');
      }
    } catch (error: any) {
      message.error({
        content: error.message || 'Failed to generate SDTM data',
        key: 'generate',
        duration: 5,
      });
      console.error('Generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (format: 'csv' | 'sas7bdat' | 'rds') => {
    try {
      message.loading({ content: `Preparing ${format.toUpperCase()} download...`, key: 'download', duration: 0 });

      const response = await fetch(`/api/v1/test-data/download-sdtm?format=${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parameters),
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${parameters.domain}_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      message.success({ content: 'Download started', key: 'download', duration: 2 });
    } catch (error: any) {
      message.error({
        content: error.message || 'Failed to download data',
        key: 'download',
        duration: 5,
      });
      console.error('Download error:', error);
    }
  };

  const handleReset = () => {
    setGeneratedData(null);
    setStatistics(null);
    setValidationResults(null);
    form.resetFields();
    setParameters({
      domain: 'DM',
      num_subjects: 50,
      missingness_pct: 10,
      distribution_type: 'realistic',
      study_start_date: '2024-01-01',
      study_end_date: '2024-12-31',
      template_source: 'pharmaverse',
    });
  };

  // Table columns for preview
  const getPreviewColumns = () => {
    if (!generatedData || generatedData.length === 0) return [];
    
    const firstRow = generatedData[0];
    return Object.keys(firstRow).map(key => ({
      title: key,
      dataIndex: key,
      key: key,
      width: 120,
      ellipsis: true,
      render: (text: any) => (
        <Tooltip title={text}>
          <span>{text || <Text type="secondary">—</Text>}</span>
        </Tooltip>
      ),
    }));
  };

  if (loadingDomains) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <p style={{ marginTop: 16 }}>Loading SDTM domains...</p>
      </div>
    );
  }

  return (
    <div className="test-with-data-panel">
      {/* Header */}
      <Card className="header-card">
        <Space align="center" size="large">
          <div className="header-icon">
            <ExperimentOutlined style={{ fontSize: 32, color: 'white' }} />
          </div>
          <div>
            <Title level={3} style={{ margin: 0 }}>Generate Test SDTM Data</Title>
            <Paragraph style={{ margin: 0, color: '#666' }}>
              Create mock SDTM datasets for testing your ADAM programs with realistic data patterns
            </Paragraph>
          </div>
        </Space>
      </Card>

      {/* Configuration Form */}
      <Card title="Data Generation Parameters" style={{ marginTop: 16 }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={parameters}
          onValuesChange={(_, allValues) => setParameters(allValues)}
        >
          <Row gutter={16}>
            {/* Domain Selection */}
            <Col span={12}>
              <Form.Item
                label="SDTM Domain"
                name="domain"
                tooltip="Select the SDTM domain to generate"
                rules={[{ required: true, message: 'Please select a domain' }]}
              >
                <Select
                  size="large"
                  onChange={handleDomainChange}
                  placeholder="Select domain"
                >
                  {domains.map(domain => (
                    <Option key={domain.code} value={domain.code}>
                      <Space>
                        <Tag color="blue">{domain.code}</Tag>
                        <span>{domain.name}</span>
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              {selectedDomain && (
                <Alert
                  message={selectedDomain.description}
                  type="info"
                  showIcon
                  icon={<InfoCircleOutlined />}
                  style={{ marginTop: -8, marginBottom: 16 }}
                />
              )}
            </Col>

            {/* Number of Subjects */}
            <Col span={12}>
              <Form.Item
                label="Number of Subjects"
                name="num_subjects"
                tooltip="Number of unique subjects to generate (1-1000)"
                rules={[{ required: true, message: 'Please enter number of subjects' }]}
              >
                <InputNumber
                  min={1}
                  max={1000}
                  style={{ width: '100%' }}
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Records Per Subject (for non-DM domains) */}
          {selectedDomain?.supports_multiple_records && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Records Per Subject"
                  name="records_per_subject"
                  tooltip="Average number of records per subject (e.g., AEs, lab tests)"
                >
                  <InputNumber
                    min={1}
                    max={100}
                    style={{ width: '100%' }}
                    size="large"
                    placeholder="Default: 3-10"
                  />
                </Form.Item>
              </Col>
              <Col span={12}></Col>
            </Row>
          )}

          <Row gutter={16}>
            {/* Missingness Percentage */}
            <Col span={12}>
              <Form.Item
                label={`Missing Data: ${parameters.missingness_pct}%`}
                name="missingness_pct"
                tooltip="Percentage of data to leave missing (0-50%)"
              >
                <Slider
                  min={0}
                  max={50}
                  marks={{ 0: '0%', 10: '10%', 25: '25%', 50: '50%' }}
                />
              </Form.Item>
            </Col>

            {/* Distribution Type */}
            <Col span={12}>
              <Form.Item
                label="Distribution Type"
                name="distribution_type"
                tooltip="Type of data distribution for numeric values"
              >
                <Radio.Group buttonStyle="solid">
                  <Radio.Button value="uniform">Uniform</Radio.Button>
                  <Radio.Button value="normal">Normal</Radio.Button>
                  <Radio.Button value="realistic">Realistic</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            {/* Study Dates */}
            <Col span={12}>
              <Form.Item
                label="Study Start Date"
                name="study_start_date"
                rules={[{ required: true, message: 'Please enter study start date' }]}
              >
                <Input type="date" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Study End Date"
                name="study_end_date"
                rules={[{ required: true, message: 'Please enter study end date' }]}
              >
                <Input type="date" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            {/* Template Source */}
            <Col span={12}>
              <Form.Item
                label="Template Source"
                name="template_source"
                tooltip="Data template to use for generation"
              >
                <Select size="large">
                  <Option value="pharmaverse">
                    <Space>
                      <Tag color="green">Pharmaverse</Tag>
                      <span>Industry Standard</span>
                    </Space>
                  </Option>
                  <Option value="cdisc">
                    <Space>
                      <Tag color="blue">CDISC</Tag>
                      <span>Reference Data</span>
                    </Space>
                  </Option>
                  <Option value="custom">
                    <Space>
                      <Tag color="purple">Custom</Tag>
                      <span>User-Defined</span>
                    </Space>
                  </Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}></Col>
          </Row>

          {/* Action Buttons */}
          <Form.Item>
            <Space size="middle">
              <Button
                type="primary"
                size="large"
                icon={<ExperimentOutlined />}
                onClick={handleGenerate}
                loading={isGenerating}
                disabled={isGenerating}
              >
                Generate Test Data
              </Button>
              <Button
                size="large"
                icon={<ReloadOutlined />}
                onClick={handleReset}
                disabled={isGenerating}
              >
                Reset
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* Statistics */}
      {statistics && (
        <Card title="Generation Summary" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="Total Rows"
                value={statistics.total_rows}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Total Columns"
                value={statistics.total_columns}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Domain"
                value={statistics.domain}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Size"
                value={statistics.memory_size_kb.toFixed(1)}
                suffix="KB"
              />
            </Col>
          </Row>

          {validationResults && (
            <>
              <Divider />
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Tag color={validationResults.is_valid ? 'success' : 'error'} icon={validationResults.is_valid ? <CheckCircleOutlined /> : <WarningOutlined />}>
                    {validationResults.is_valid ? 'Validation Passed' : 'Validation Issues'}
                  </Tag>
                </div>
                {validationResults.errors && validationResults.errors.length > 0 && (
                  <Alert
                    message="Errors"
                    description={
                      <ul>
                        {validationResults.errors.map((err: string, idx: number) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    }
                    type="error"
                    showIcon
                  />
                )}
                {validationResults.warnings && validationResults.warnings.length > 0 && (
                  <Alert
                    message="Warnings"
                    description={
                      <ul>
                        {validationResults.warnings.map((warn: string, idx: number) => (
                          <li key={idx}>{warn}</li>
                        ))}
                      </ul>
                    }
                    type="warning"
                    showIcon
                  />
                )}
              </Space>
            </>
          )}

          <Divider />
          <Space size="middle">
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload('csv')}
              disabled={!generatedData}
            >
              Download CSV
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => handleDownload('sas7bdat')}
              disabled={!generatedData}
            >
              Download SAS
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => handleDownload('rds')}
              disabled={!generatedData}
            >
              Download RDS
            </Button>
          </Space>
        </Card>
      )}

      {/* Preview Table */}
      {generatedData && generatedData.length > 0 && (
        <Card
          title="Data Preview (First 10 Rows)"
          style={{ marginTop: 16 }}
          extra={
            <Text type="secondary">
              Showing {Math.min(10, generatedData.length)} of {statistics?.total_rows || 0} rows
            </Text>
          }
        >
          <Table
            dataSource={generatedData}
            columns={getPreviewColumns()}
            scroll={{ x: 'max-content' }}
            pagination={false}
            size="small"
            bordered
          />
        </Card>
      )}
    </div>
  );
};

export default TestWithDataPanel;
