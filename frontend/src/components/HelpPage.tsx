import { Modal, Typography, Card, Row, Col, Tag, Statistic, Divider } from 'antd';
import {
  RocketOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  SafetyOutlined,
  ToolOutlined,
  SwapOutlined,
  ExperimentOutlined,
  BranchesOutlined,
  CodeOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  HighlightOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  StarOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import './HelpPage.css';

const { Title, Paragraph, Text } = Typography;

interface HelpPageProps {
  visible: boolean;
  onClose: () => void;
}

const HelpPage = ({ visible, onClose }: HelpPageProps) => {
  const platformStats = [
    { title: 'Time Saved', value: '70-80%', suffix: '', prefix: <ClockCircleOutlined /> },
    { title: 'Cost Reduction', value: '60%', suffix: '', prefix: <DollarOutlined /> },
    { title: 'Accuracy', value: '95%+', suffix: '', prefix: <CheckCircleOutlined /> },
    { title: 'CDISC Compliance', value: '100%', suffix: '', prefix: <StarOutlined /> },
  ];

  const platformFeatures = [
    {
      category: 'SDTM.AI',
      icon: <DatabaseOutlined />,
      color: '#1890ff',
      description: 'Streamline Study Data Tabulation Model dataset creation with AI-powered test data generation',
      benefits: [
        'Automated SDTM dataset generation',
        'CDISC compliance validation',
        'Rapid test data creation for clinical trials',
      ],
    },
    {
      category: 'ADAM.AI',
      icon: <RocketOutlined />,
      color: '#1890ff',
      description: 'Transform ADAM specifications into production-ready code with intelligent automation',
      benefits: [
        'AI-powered code generation (R/SAS)',
        'Automated traceability mapping',
        'Pair programming with AI assistance',
        'Real-time code validation',
      ],
    },
    {
      category: 'TLF.AI',
      icon: <FileTextOutlined />,
      color: '#1890ff',
      description: 'Generate Tables, Listings, and Figures with intelligent automation and R integration',
      benefits: [
        'Automated TLF generation',
        'R frontend integration',
        'Standardized output formatting',
        'Regulatory-ready documentation',
      ],
    },
    {
      category: 'Compliance.AI',
      icon: <SafetyOutlined />,
      color: '#52c41a',
      description: 'Ensure regulatory readiness with comprehensive submission validation and package generation',
      benefits: [
        'Submission readiness scoring',
        'FDA compliance validation',
        'eCTD package generation',
        'Automated quality checks',
      ],
    },
    {
      category: 'CodeMigration.AI',
      icon: <SwapOutlined />,
      color: '#722ed1',
      description: 'Seamlessly convert SAS code to R with intelligent automation and framework support',
      benefits: [
        'SAS to R code conversion',
        'Legacy system modernization',
        'Automated refactoring',
        'Framework migration support',
      ],
    },
    {
      category: 'Utilities.AI',
      icon: <ToolOutlined />,
      color: '#fa8c16',
      description: 'Comprehensive AI-powered utilities for enhanced productivity and collaboration',
      benefits: [
        'Study ChatBot for instant Q&A',
        'Code and dataset comparison tools',
        'Advanced analytics dashboard',
        'R frontend integration',
      ],
    },
  ];

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1400}
      className="help-modal-executive"
      centered
      styles={{ body: { padding: 0 } }}
    >
      <div className="help-content-executive">
        {/* Executive Hero Section */}
        <div className="help-hero-executive">
          <div className="hero-content">
            <Title level={1} className="hero-title-executive">
              ADAM AI Platform
            </Title>
            <Title level={3} className="hero-subtitle-executive">
              Enterprise-Grade AI Solutions for Clinical Data Management
            </Title>
            <Paragraph className="hero-description-executive">
              Transform your clinical trial data operations with our comprehensive suite of AI-powered tools. 
              Reduce development time by 70-80%, ensure 100% CDISC compliance, and accelerate time-to-market 
              for regulatory submissions.
            </Paragraph>
          </div>
        </div>

        {/* Platform Statistics */}
        <div className="stats-section">
          <Row gutter={[24, 24]}>
            {platformStats.map((stat, index) => (
              <Col xs={12} sm={12} md={6} key={index}>
                <Card className="stat-card" bordered={false}>
                  <Statistic
                    title={stat.title}
                    value={stat.value}
                    prefix={stat.prefix}
                    valueStyle={{ color: '#1890ff', fontSize: '28px', fontWeight: 700 }}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        <Divider style={{ margin: '40px 0' }} />

        {/* Platform Overview */}
        <section className="platform-overview-section">
          <div className="section-header-executive">
            <Title level={2} className="section-title-executive">
              Complete Platform Suite
            </Title>
            <Paragraph className="section-description-executive">
              Our integrated platform provides end-to-end solutions for clinical data management, 
              from data collection to regulatory submission. Each module is designed to work seamlessly 
              together, creating a unified workflow that maximizes efficiency and ensures compliance.
            </Paragraph>
          </div>

          <Row gutter={[24, 24]}>
            {platformFeatures.map((feature, index) => (
              <Col xs={24} sm={24} md={12} lg={8} key={index}>
                <Card
                  className="feature-card-executive"
                  hoverable
                  bordered={false}
                  style={{ borderTop: `4px solid ${feature.color}` }}
                >
                  <div className="feature-header-executive">
                    <div className="feature-icon-wrapper" style={{ background: `${feature.color}15` }}>
                      <span style={{ color: feature.color, fontSize: '32px' }}>
                        {feature.icon}
                      </span>
                    </div>
                    <Title level={4} className="feature-title-executive">
                      {feature.category}
                    </Title>
                  </div>
                  <Paragraph className="feature-description-executive">
                    {feature.description}
                  </Paragraph>
                  <div className="feature-benefits">
                    <Text strong style={{ fontSize: '13px', color: '#595959' }}>Key Benefits:</Text>
                    <ul className="benefits-list">
                      {feature.benefits.map((benefit, idx) => (
                        <li key={idx}>
                          <CheckCircleOutlined style={{ color: feature.color, marginRight: '8px' }} />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </section>

        <Divider style={{ margin: '40px 0' }} />

        {/* Business Value Proposition */}
        <section className="value-proposition-section">
          <div className="section-header-executive">
            <Title level={2} className="section-title-executive">
              Business Impact & ROI
            </Title>
          </div>
          <Row gutter={[24, 24]}>
            <Col xs={24} md={12}>
              <Card className="value-card" bordered={false}>
                <TeamOutlined className="value-icon" style={{ color: '#1890ff' }} />
                <Title level={4}>Operational Excellence</Title>
                <Paragraph>
                  <strong>Reduce Development Cycles:</strong> Cut ADAM dataset development time from weeks to days. 
                  Our AI-powered automation handles complex derivations, freeing your team to focus on strategic analysis.
                </Paragraph>
                <Paragraph>
                  <strong>Scale Without Limits:</strong> Handle multiple studies simultaneously without proportional 
                  increases in headcount. One analyst can now manage what previously required a team.
                </Paragraph>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card className="value-card" bordered={false}>
                <DollarOutlined className="value-icon" style={{ color: '#52c41a' }} />
                <Title level={4}>Cost Optimization</Title>
                <Paragraph>
                  <strong>Reduce Operational Costs:</strong> Achieve 60%+ reduction in data management costs through 
                  automation and efficiency gains. Eliminate repetitive manual coding tasks.
                </Paragraph>
                <Paragraph>
                  <strong>Faster Time-to-Market:</strong> Accelerate regulatory submissions by weeks, enabling 
                  earlier market entry and increased revenue potential.
                </Paragraph>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card className="value-card" bordered={false}>
                <SafetyOutlined className="value-icon" style={{ color: '#722ed1' }} />
                <Title level={4}>Risk Mitigation</Title>
                <Paragraph>
                  <strong>100% CDISC Compliance:</strong> Built-in validation ensures every output meets regulatory 
                  standards. Reduce submission rejections and costly rework cycles.
                </Paragraph>
                <Paragraph>
                  <strong>Audit Trail & Traceability:</strong> Complete lineage tracking from source data to final 
                  submission, ensuring full transparency and regulatory compliance.
                </Paragraph>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card className="value-card" bordered={false}>
                <RocketOutlined className="value-icon" style={{ color: '#fa8c16' }} />
                <Title level={4}>Competitive Advantage</Title>
                <Paragraph>
                  <strong>Innovation Leadership:</strong> Leverage cutting-edge AI technology to stay ahead of 
                  industry standards and deliver superior quality outputs.
                </Paragraph>
                <Paragraph>
                  <strong>Enhanced Collaboration:</strong> AI-powered pair programming and intelligent assistants 
                  enable knowledge transfer and consistent quality across teams.
                </Paragraph>
              </Card>
            </Col>
          </Row>
        </section>

        <Divider style={{ margin: '40px 0' }} />

        {/* Use Cases */}
        <section className="use-cases-section">
          <div className="section-header-executive">
            <Title level={2} className="section-title-executive">
              Enterprise Use Cases
            </Title>
          </div>
          <Row gutter={[24, 24]}>
            <Col xs={24} md={8}>
              <Card className="use-case-card" bordered={false}>
                <Tag color="blue" style={{ marginBottom: '16px', fontSize: '12px', padding: '4px 12px' }}>
                  PHASE 1-3 TRIALS
                </Tag>
                <Title level={4}>Clinical Trial Data Management</Title>
                <Paragraph>
                  Streamline end-to-end data management from SDTM creation through ADAM analysis datasets 
                  to final TLF generation. Ensure consistency and compliance across all study phases.
                </Paragraph>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="use-case-card" bordered={false}>
                <Tag color="green" style={{ marginBottom: '16px', fontSize: '12px', padding: '4px 12px' }}>
                  REGULATORY SUBMISSION
                </Tag>
                <Title level={4}>FDA Submission Preparation</Title>
                <Paragraph>
                  Validate submission readiness, generate eCTD packages, and ensure all regulatory requirements 
                  are met before submission. Reduce review cycles and accelerate approvals.
                </Paragraph>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="use-case-card" bordered={false}>
                <Tag color="purple" style={{ marginBottom: '16px', fontSize: '12px', padding: '4px 12px' }}>
                  LEGACY MODERNIZATION
                </Tag>
                <Title level={4}>SAS to R Conversion & Modernization</Title>
                <Paragraph>
                  Convert legacy SAS code to R using our intelligent conversion framework. Modernize outdated 
                  frameworks, standardize coding practices across your organization, and maintain business logic 
                  while upgrading your technology stack.
                </Paragraph>
              </Card>
            </Col>
          </Row>
        </section>

        {/* Call to Action */}
        <div className="cta-section-executive">
          <Card className="cta-card-executive" bordered={false}>
            <RocketOutlined className="cta-icon-executive" />
            <Title level={3} className="cta-title-executive">
              Ready to Transform Your Clinical Data Operations?
            </Title>
            <Paragraph className="cta-description-executive">
              Join leading pharmaceutical companies who are already leveraging ADAM AI to accelerate 
              their clinical trials and reduce operational costs.
            </Paragraph>
            <div className="cta-buttons">
              <Tag color="processing" style={{ fontSize: '14px', padding: '8px 16px' }}>
                <ArrowRightOutlined /> Start Your Journey Today
              </Tag>
            </div>
          </Card>
        </div>
      </div>
    </Modal>
  );
};

export default HelpPage;
