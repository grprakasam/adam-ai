import { Modal, Typography, Timeline, Card, Row, Col, Tag, Steps } from 'antd';
import {
  RocketOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  TeamOutlined,
  FileTextOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  BulbOutlined,
  ToolOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  ArrowRightOutlined,
  StarOutlined,
  ExperimentOutlined
} from '@ant-design/icons';
import './HelpPage.css';

const { Title, Paragraph, Text } = Typography;

interface HelpPageProps {
  visible: boolean;
  onClose: () => void;
}

const HelpPage = ({ visible, onClose }: HelpPageProps) => {
  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1200}
      className="help-modal"
      centered
    >
      <div className="help-content">
        {/* Hero Section */}
        <div className="help-hero">
          <RocketOutlined className="help-hero-icon" />
          <Title level={2} className="help-title">
            Welcome to ADAM AI Code Generator
          </Title>
          <Paragraph className="help-subtitle">
            Your intelligent companion for automated ADAM dataset generation
          </Paragraph>
        </div>

        {/* What is ADAM AI Section */}
        <section className="help-section">
          <div className="section-header">
            <BulbOutlined className="section-icon" />
            <Title level={3}>What is ADAM AI?</Title>
          </div>
          <Card className="info-card gradient-card">
            <Paragraph className="large-text">
              ADAM AI Code Generator is an innovative tool that revolutionizes clinical trial data analysis 
              by leveraging artificial intelligence to automatically generate ADAM (Analysis Data Model) datasets. 
              Transform your ADAM specification documents into production-ready R or SAS code in minutes, not days.
            </Paragraph>
          </Card>
        </section>

        {/* Key Benefits */}
        <section className="help-section">
          <div className="section-header">
            <StarOutlined className="section-icon" />
            <Title level={3}>Key Benefits</Title>
          </div>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Card className="benefit-card" hoverable>
                <ThunderboltOutlined className="benefit-icon speed" />
                <Title level={4}>Lightning Fast</Title>
                <Paragraph>
                  Reduce coding time by 70-80%. Generate complex derivations in seconds instead of hours.
                </Paragraph>
              </Card>
            </Col>
            <Col span={12}>
              <Card className="benefit-card" hoverable>
                <SafetyOutlined className="benefit-icon accuracy" />
                <Title level={4}>CDISC Compliant</Title>
                <Paragraph>
                  Built-in CDISC standards ensure your code follows industry best practices automatically.
                </Paragraph>
              </Card>
            </Col>
            <Col span={12}>
              <Card className="benefit-card" hoverable>
                <TeamOutlined className="benefit-icon collaboration" />
                <Title level={4}>AI-Powered Intelligence</Title>
                <Paragraph>
                  Advanced LLM models understand context and generate intelligent, optimized code solutions.
                </Paragraph>
              </Card>
            </Col>
            <Col span={12}>
              <Card className="benefit-card" hoverable>
                <CodeOutlined className="benefit-icon quality" />
                <Title level={4}>Production Ready</Title>
                <Paragraph>
                  Generated code includes comprehensive comments, error handling, and follows coding standards.
                </Paragraph>
              </Card>
            </Col>
          </Row>
        </section>

        {/* How It Works */}
        <section className="help-section">
          <div className="section-header">
            <ToolOutlined className="section-icon" />
            <Title level={3}>How It Works</Title>
          </div>
          <Steps
            direction="vertical"
            className="workflow-steps"
            items={[
              {
                title: 'Upload ADAM Specification',
                description: 'Upload your ADAM specification Excel file containing variable definitions and derivation logic',
                icon: <FileTextOutlined />,
                status: 'finish'
              },
              {
                title: 'AI Analysis & Categorization',
                description: 'Our AI engine analyzes variables and categorizes them by complexity (Direct Mapping, Simple Derivation, Complex Logic, etc.)',
                icon: <ExperimentOutlined />,
                status: 'finish'
              },
              {
                title: 'Configure AI Model',
                description: 'Choose your preferred programming language (R/SAS) and select from multiple LLM providers (Groq, OpenAI, Anthropic, OpenRouter)',
                icon: <ApiOutlined />,
                status: 'finish'
              },
              {
                title: 'Review & Generate',
                description: 'Review categorized variables, add custom notes, and generate code variable-by-variable or in bulk',
                icon: <CodeOutlined />,
                status: 'finish'
              },
              {
                title: 'Refine & Export',
                description: 'Review generated code with AI rationale, make modifications, and export your complete ADAM program',
                icon: <CheckCircleOutlined />,
                status: 'finish'
              }
            ]}
          />
        </section>

        {/* Workflow Timeline */}
        <section className="help-section">
          <div className="section-header">
            <SyncOutlined className="section-icon" />
            <Title level={3}>Complete Workflow</Title>
          </div>
          <Card className="workflow-card">
            <Timeline
              mode="left"
              items={[
                {
                  label: 'Step 1',
                  color: 'blue',
                  dot: <FileTextOutlined />,
                  children: (
                    <div>
                      <Text strong>Upload Specification File</Text>
                      <Paragraph className="timeline-desc">
                        Navigate to the "Variables Analysis" tab and upload your Excel specification file. 
                        The file should contain columns like Variable Name, Label, Type, Length, and Derivation Logic.
                      </Paragraph>
                    </div>
                  )
                },
                {
                  label: 'Step 2',
                  color: 'green',
                  dot: <ExperimentOutlined />,
                  children: (
                    <div>
                      <Text strong>Automatic Categorization</Text>
                      <Paragraph className="timeline-desc">
                        Click "Re-analyze Variables" to let AI categorize your variables. Watch as the system 
                        intelligently groups variables by their complexity and derivation requirements.
                      </Paragraph>
                      <div className="tag-group">
                        <Tag color="green">Direct Mapping</Tag>
                        <Tag color="blue">Simple Derivation</Tag>
                        <Tag color="orange">Complex Logic</Tag>
                        <Tag color="purple">Statistical</Tag>
                      </div>
                    </div>
                  )
                },
                {
                  label: 'Step 3',
                  color: 'purple',
                  dot: <ApiOutlined />,
                  children: (
                    <div>
                      <Text strong>Configure AI Settings</Text>
                      <Paragraph className="timeline-desc">
                        Select your programming language (R or SAS) and choose from multiple AI providers. 
                        Test the connection to ensure everything is working properly.
                      </Paragraph>
                      <div className="provider-tags">
                        <Tag icon={<ThunderboltOutlined />} color="cyan">Groq (Fast)</Tag>
                        <Tag icon={<BulbOutlined />} color="green">OpenAI (Smart)</Tag>
                        <Tag icon={<StarOutlined />} color="purple">Anthropic (Claude)</Tag>
                        <Tag icon={<ApiOutlined />} color="blue">OpenRouter (Flexible)</Tag>
                      </div>
                    </div>
                  )
                },
                {
                  label: 'Step 4',
                  color: 'orange',
                  dot: <CodeOutlined />,
                  children: (
                    <div>
                      <Text strong>Generate Code</Text>
                      <Paragraph className="timeline-desc">
                        Switch to "Pair Programming" mode. Click "Get AI Inputs" for individual variables 
                        or use bulk generation for multiple variables at once. Review the generated code 
                        and AI rationale for each variable.
                      </Paragraph>
                    </div>
                  )
                },
                {
                  label: 'Step 5',
                  color: 'red',
                  dot: <CheckCircleOutlined />,
                  children: (
                    <div>
                      <Text strong>Review & Refine</Text>
                      <Paragraph className="timeline-desc">
                        Add custom notes to guide the AI, regenerate if needed, and mark variables as 
                        "Accept" or "Modify". The AI learns from your feedback to improve future generations.
                      </Paragraph>
                    </div>
                  )
                },
                {
                  label: 'Step 6',
                  color: 'green',
                  dot: <ArrowRightOutlined />,
                  children: (
                    <div>
                      <Text strong>Export & ADAM Code</Text>
                      <Paragraph className="timeline-desc">
                        Export your complete ADAM program with all accepted code snippets. The generated 
                        code includes comprehensive comments, proper formatting, and follows industry standards.
                      </Paragraph>
                    </div>
                  )
                }
              ]}
            />
          </Card>
        </section>

        {/* Features Highlight */}
        <section className="help-section">
          <div className="section-header">
            <ExperimentOutlined className="section-icon" />
            <Title level={3}>Powerful Features</Title>
          </div>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Card className="feature-card" bordered={false}>
                <ClockCircleOutlined className="feature-icon" />
                <Title level={4}>Real-time Generation</Title>
                <Paragraph>
                  Watch code being generated in real-time with progress indicators and instant feedback.
                </Paragraph>
              </Card>
            </Col>
            <Col span={8}>
              <Card className="feature-card" bordered={false}>
                <BulbOutlined className="feature-icon" />
                <Title level={4}>AI Rationale</Title>
                <Paragraph>
                  Understand why the AI made specific coding decisions with detailed explanations.
                </Paragraph>
              </Card>
            </Col>
            <Col span={8}>
              <Card className="feature-card" bordered={false}>
                <SyncOutlined className="feature-icon" />
                <Title level={4}>Iterative Refinement</Title>
                <Paragraph>
                  Add notes, regenerate, and refine until you get exactly the code you need.
                </Paragraph>
              </Card>
            </Col>
          </Row>
        </section>

        {/* Best Practices */}
        <section className="help-section">
          <div className="section-header">
            <CheckCircleOutlined className="section-icon" />
            <Title level={3}>Best Practices</Title>
          </div>
          <Card className="tips-card">
            <ul className="tips-list">
              <li>
                <CheckCircleOutlined className="tip-icon" />
                <Text strong>Clear Specifications:</Text> Ensure your Excel file has clear derivation logic for better AI understanding
              </li>
              <li>
                <CheckCircleOutlined className="tip-icon" />
                <Text strong>Test Connection:</Text> Always test your LLM connection before starting code generation
              </li>
              <li>
                <CheckCircleOutlined className="tip-icon" />
                <Text strong>Add Context:</Text> Use custom notes to provide additional context for complex variables
              </li>
              <li>
                <CheckCircleOutlined className="tip-icon" />
                <Text strong>Review Generated Code:</Text> Always review AI-generated code before production use
              </li>
              <li>
                <CheckCircleOutlined className="tip-icon" />
                <Text strong>Iterative Approach:</Text> Start with a few variables to test, then scale up to bulk generation
              </li>
              <li>
                <CheckCircleOutlined className="tip-icon" />
                <Text strong>Save Progress:</Text> Your work is automatically saved, so you can return anytime
              </li>
            </ul>
          </Card>
        </section>

        {/* Call to Action */}
        <div className="help-cta">
          <Title level={4}>Ready to Transform Your ADAM Workflow?</Title>
          <Paragraph>
            Click "Get Started" on the landing page to begin your journey with AI-powered code generation!
          </Paragraph>
        </div>
      </div>
    </Modal>
  );
};

export default HelpPage;
