import React, { useState } from 'react';
import {
  Card,
  Steps,
  Button,
  Radio,
  Form,
  Input,
  Upload,
  message,
  Space,
  Typography,
  Alert,
  Spin,
  Divider,
  Tag,
  Row,
  Col
} from 'antd';
import {
  TableOutlined,
  UnorderedListOutlined,
  PieChartOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  EditOutlined,
  FileTextOutlined,
  RobotOutlined,
  DownloadOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { PageHeader } from './PageHeader';
import './TLFGeneratorTab.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Step } = Steps;

interface TLFGeneratorTabProps {
  standalone?: boolean;
}

export const TLFGeneratorTab: React.FC<TLFGeneratorTabProps> = ({ standalone = false }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedType, setSelectedType] = useState<'table' | 'listing' | 'figure' | null>(null);
  const [form] = Form.useForm();
  const [uploadedFile, setUploadedFile] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [understanding, setUnderstanding] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedOutput, setGeneratedOutput] = useState<any>(null);

  // Step 1: Select TLF Type
  const renderTypeSelection = () => {
    const tlfTypes = [
      {
        key: 'table',
        title: 'Table',
        icon: <TableOutlined />,
        description: 'Statistical summary tables with demographics, efficacy, or safety data',
        examples: 'Demographics, Adverse Events Summary, Lab Values',
        color: '#1890ff'
      },
      {
        key: 'listing',
        title: 'Listing',
        icon: <UnorderedListOutlined />,
        description: 'Detailed line-by-line data listings for subject-level information',
        examples: 'Subject Disposition, AE Listings, Concomitant Medications',
        color: '#52c41a'
      },
      {
        key: 'figure',
        title: 'Figure',
        icon: <PieChartOutlined />,
        description: 'Graphical visualizations including plots, charts, and diagrams',
        examples: 'Kaplan-Meier Curves, Mean Change Plots, Lab Trends',
        color: '#722ed1'
      }
    ];

    return (
      <div className="tlf-type-selection">
        <div className="selection-header">
          <Title level={3}>Select Output Type</Title>
          <Paragraph>Choose the type of statistical output you want to create</Paragraph>
        </div>

        <Row gutter={[24, 24]}>
          {tlfTypes.map((type) => (
            <Col xs={24} md={8} key={type.key}>
              <Card
                className={`tlf-type-card ${selectedType === type.key ? 'selected' : ''}`}
                hoverable
                onClick={() => setSelectedType(type.key as any)}
                style={{ borderColor: selectedType === type.key ? type.color : undefined }}
              >
                <div className="tlf-type-icon" style={{ color: type.color }}>
                  {type.icon}
                </div>
                <Title level={4}>{type.title}</Title>
                <Paragraph className="tlf-description">{type.description}</Paragraph>
                <Divider />
                <div className="tlf-examples">
                  <Text type="secondary" strong>Examples:</Text>
                  <Text type="secondary">{type.examples}</Text>
                </div>
                {selectedType === type.key && (
                  <div className="selected-badge">
                    <CheckCircleOutlined /> Selected
                  </div>
                )}
              </Card>
            </Col>
          ))}
        </Row>

        <div className="step-actions">
          <Button
            type="primary"
            size="large"
            onClick={() => setCurrentStep(1)}
            disabled={!selectedType}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  };

  // Step 2: Upload Form & Questions
  const renderUploadForm = () => {
    const handleFileUpload = (info: any) => {
      const { file } = info;
      if (file.status !== 'uploading') {
        setUploadedFile(file);
      }
    };

    const handleSubmit = async (values: any) => {
      if (!uploadedFile) {
        message.error('Please upload a mockshell document');
        return;
      }

      setAnalyzing(true);

      try {
        const formData = new FormData();
        formData.append('file', uploadedFile.originFileObj);
        formData.append('tlf_type', selectedType!);
        formData.append('study_id', values.study_id || '');
        formData.append('dataset_name', values.dataset_name || '');
        formData.append('output_name', values.output_name || '');
        formData.append('description', values.description || '');
        formData.append('additional_context', values.additional_context || '');

        const response = await fetch('/api/v1/tlf-generator/analyze', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Analysis failed');
        }

        const result = await response.json();
        setSessionId(result.session_id);
        setUnderstanding(result);
        message.success('Mockshell analyzed successfully!');
        setCurrentStep(2);
      } catch (error) {
        message.error('Failed to analyze mockshell. Please try again.');
        console.error(error);
      } finally {
        setAnalyzing(false);
      }
    };

    return (
      <div className="tlf-upload-form">
        <div className="form-header">
          <RobotOutlined style={{ fontSize: 32, color: '#1890ff' }} />
          <Title level={3}>Upload Mockshell Document</Title>
          <Paragraph>
            Provide details about your {selectedType} and upload a mockshell document for AI analysis
          </Paragraph>
        </div>

        <Alert
          message="Supported Formats"
          description="PDF, Word (docx), Excel (xlsx), Images (PNG, JPG), or any document format containing your mockshell design"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          className="tlf-form"
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Study ID"
                name="study_id"
                rules={[{ required: true, message: 'Please enter study ID' }]}
              >
                <Input placeholder="e.g., STUDY-001" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Dataset Name"
                name="dataset_name"
                tooltip="Source ADAM dataset (e.g., ADSL, ADAE, ADLB)"
              >
                <Input placeholder="e.g., ADSL" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Output Name"
                name="output_name"
                tooltip="Standard output naming (e.g., T_14_1_01 for tables)"
              >
                <Input placeholder="e.g., T_14_1_01" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label="Description"
                name="description"
              >
                <Input placeholder="Brief description of the output" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Upload Mockshell Document"
            required
            tooltip="Upload your mockshell design document. AI will analyze and extract specifications."
          >
            <Upload
              beforeUpload={() => false}
              onChange={handleFileUpload}
              maxCount={1}
              accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
            >
              <Button icon={<UploadOutlined />} size="large" block>
                {uploadedFile ? uploadedFile.name : 'Click to Upload'}
              </Button>
            </Upload>
          </Form.Item>

          <Form.Item
            label="Additional Context"
            name="additional_context"
            tooltip="Any specific requirements, notes, or special instructions"
          >
            <TextArea
              rows={4}
              placeholder="e.g., Include footnotes for missing data, use specific formatting..."
            />
          </Form.Item>

          <div className="step-actions">
            <Space>
              <Button onClick={() => setCurrentStep(0)}>
                Back
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={analyzing}
                size="large"
                icon={<RobotOutlined />}
              >
                {analyzing ? 'Analyzing with AI...' : 'Analyze Document'}
              </Button>
            </Space>
          </div>
        </Form>
      </div>
    );
  };

  // Step 3: Review Understanding
  const renderUnderstandingReview = () => {
    const handleApprove = async () => {
      try {
        const response = await fetch('/api/v1/tlf-generator/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            approved: true
          })
        });

        if (!response.ok) {
          throw new Error('Approval failed');
        }

        message.success('Understanding approved! Generating output...');
        handleGenerate();
      } catch (error) {
        message.error('Failed to approve understanding');
        console.error(error);
      }
    };

    const handleReject = () => {
      setCurrentStep(1);
      message.info('You can modify your inputs or re-upload the document');
    };

    const renderUnderstandingDetails = () => {
      if (!understanding?.understanding) return null;

      const { structure, formatting, requirements } = understanding.understanding;

      return (
        <div className="understanding-details">
          {structure && (
            <Card title="Structure" className="detail-card">
              <pre>{JSON.stringify(structure, null, 2)}</pre>
            </Card>
          )}

          {formatting && (
            <Card title="Formatting" className="detail-card">
              <pre>{JSON.stringify(formatting, null, 2)}</pre>
            </Card>
          )}

          {requirements && Array.isArray(requirements) && (
            <Card title="Requirements" className="detail-card">
              <ul>
                {requirements.map((req: string, idx: number) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      );
    };

    return (
      <div className="understanding-review">
        <div className="review-header">
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
          <Title level={3}>AI Understanding Complete</Title>
          <Paragraph>
            Review the AI's interpretation of your mockshell. Approve to proceed with generation.
          </Paragraph>
        </div>

        <Alert
          message={`Confidence Score: ${(understanding?.confidence_score * 100).toFixed(0)}%`}
          description="This indicates how confident the AI is about understanding your mockshell"
          type={understanding?.confidence_score > 0.7 ? 'success' : 'warning'}
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Card className="understanding-card">
          <div className="understanding-summary">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Text strong>TLF Type:</Text> <Tag color="blue">{understanding?.tlf_type}</Tag>
              </div>

              {renderUnderstandingDetails()}

              {understanding?.suggested_modifications && understanding.suggested_modifications.length > 0 && (
                <Alert
                  message="Suggestions"
                  description={
                    <ul>
                      {understanding.suggested_modifications.map((sug: string, idx: number) => (
                        <li key={idx}>{sug}</li>
                      ))}
                    </ul>
                  }
                  type="info"
                  showIcon
                />
              )}

              {understanding?.requires_clarification && understanding.requires_clarification.length > 0 && (
                <Alert
                  message="Clarifications Needed"
                  description={
                    <ul>
                      {understanding.requires_clarification.map((clar: string, idx: number) => (
                        <li key={idx}>{clar}</li>
                      ))}
                    </ul>
                  }
                  type="warning"
                  showIcon
                />
              )}
            </Space>
          </div>
        </Card>

        <div className="step-actions">
          <Space size="large">
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReject}
              size="large"
            >
              Re-upload Document
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleApprove}
              size="large"
            >
              Approve & Generate
            </Button>
          </Space>
        </div>
      </div>
    );
  };

  // Step 4: Display Generated Output
  const handleGenerate = async () => {
    setGenerating(true);
    setCurrentStep(3);

    try {
      const response = await fetch('/api/v1/tlf-generator/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          format: 'html',
          include_citations: true
        })
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      const result = await response.json();
      setGeneratedOutput(result);
      message.success('TLF generated successfully!');
    } catch (error) {
      message.error('Failed to generate TLF');
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  const renderGeneratedOutput = () => {
    if (generating) {
      return (
        <div className="generating-state">
          <Spin size="large" />
          <Title level={4}>Generating Your {selectedType}...</Title>
          <Paragraph>This may take a moment. Our AI is creating a production-ready output.</Paragraph>
        </div>
      );
    }

    if (!generatedOutput) {
      return null;
    }

    return (
      <div className="generated-output">
        <div className="output-header">
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
          <Title level={3}>Generation Complete!</Title>
          <Paragraph>Your {selectedType} has been successfully generated</Paragraph>
        </div>

        <Card
          className="output-card"
          title={
            <Space>
              <FileTextOutlined />
              {generatedOutput.metadata?.output_name || `Generated ${selectedType}`}
            </Space>
          }
          extra={
            <Space>
              <Button icon={<DownloadOutlined />} type="primary">
                Download
              </Button>
              <Button icon={<EditOutlined />}>
                Edit
              </Button>
            </Space>
          }
        >
          <div
            className="output-content"
            dangerouslySetInnerHTML={{ __html: generatedOutput.output }}
          />

          {generatedOutput.citations && generatedOutput.citations.length > 0 && (
            <div className="citations-section">
              <Divider />
              <Title level={5}>Citations</Title>
              <ul>
                {generatedOutput.citations.map((citation: any, idx: number) => (
                  <li key={idx}>
                    <Text type="secondary">{citation.reference}</Text>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <div className="step-actions">
          <Button
            size="large"
            onClick={() => {
              setCurrentStep(0);
              setSelectedType(null);
              setUploadedFile(null);
              setUnderstanding(null);
              setGeneratedOutput(null);
              setSessionId(null);
              form.resetFields();
            }}
          >
            Create Another TLF
          </Button>
        </div>
      </div>
    );
  };

  const steps = [
    { title: 'Select Type', icon: <TableOutlined /> },
    { title: 'Upload & Details', icon: <UploadOutlined /> },
    { title: 'Review', icon: <CheckCircleOutlined /> },
    { title: 'Generate', icon: <RobotOutlined /> }
  ];

  return (
    <div className="tlf-generator-tab">
      {/* Blue Header */}
      <PageHeader
        title="TLF Generator"
        subtitle="Create Tables, Listings, and Figures from mockshell documents using AI"
        icon={<RobotOutlined />}
      />

      <Card className="tlf-main-card" style={{ marginTop: 0, borderRadius: '0 0 8px 8px' }}>
        <Steps current={currentStep} items={steps} style={{ marginBottom: 32 }} />

        {currentStep === 0 && renderTypeSelection()}
        {currentStep === 1 && renderUploadForm()}
        {currentStep === 2 && renderUnderstandingReview()}
        {currentStep === 3 && renderGeneratedOutput()}
      </Card>
    </div>
  );
};

export default TLFGeneratorTab;









