import { Typography } from 'antd';
import {
    UserSwitchOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    QuestionCircleOutlined,
    BulbOutlined,
    SafetyOutlined,
} from '@ant-design/icons';
import { PageHeader } from './PageHeader';
import './PlaceholderFeature.css';

const { Title, Text } = Typography;

const FDAReviewerPreviewTab = () => {
    return (
        <div className="placeholder-feature-container">
            {/* Blue Header */}
            <PageHeader
                title="FDA Reviewer Persona"
                subtitle="AI role-plays as an FDA reviewer to identify weak spots in your submission"
                icon={<UserSwitchOutlined />}
            />

            <div className="placeholder-feature-content">
                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <UserSwitchOutlined style={{ color: '#13c2c2' }} />
                        What is FDA Reviewer Persona Preview?
                    </Title>
                    <div className="placeholder-feature-section-content">
                        <p>
                            The FDA Reviewer Persona Preview is an innovative AI tool that simulates an FDA
                            reviewer's perspective on your submission package. It asks the tough questions
                            that reviewers might ask, helping you identify and address weak spots before submission.
                        </p>
                        <p>
                            Based on historical FDA review patterns and common Information Requests (IRs),
                            this tool helps you anticipate reviewer concerns and strengthen your submission.
                        </p>
                    </div>
                </div>

                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <QuestionCircleOutlined style={{ color: '#13c2c2' }} />
                        Example Reviewer Questions
                    </Title>
                    <div className="placeholder-feature-section-content">
                        <p>AI will analyze your submission and ask questions like:</p>
                        <div className="placeholder-feature-example submission-ai">
                            <strong>🔍 FDA Reviewer Persona Questions:</strong><br /><br />
                            <strong>Q1 (SAP Section 4.2):</strong> "Can you explain the rationale for the
                            primary endpoint definition on page 45 of the SAP? The non-responder imputation
                            approach differs from similar approved products."<br /><br />
                            <strong>Q2 (ADSL Dataset):</strong> "The treatment discontinuation rate is 18%
                            in the active arm. Please provide additional analysis excluding these subjects
                            to assess sensitivity."<br /><br />
                            <strong>Q3 (Safety Analysis):</strong> "Three subjects experienced Grade 4
                            hepatotoxicity. Please clarify the temporal relationship with study drug
                            administration and any dose modifications."
                        </div>
                    </div>
                </div>

                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <BulbOutlined style={{ color: '#13c2c2' }} />
                        Key Benefits
                    </Title>
                    <div className="placeholder-feature-benefits">
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon submission-ai">
                                <QuestionCircleOutlined />
                            </div>
                            <div className="placeholder-benefit-title">Anticipate Questions</div>
                            <div className="placeholder-benefit-description">
                                Get ahead of potential FDA questions and prepare responses before submission.
                            </div>
                        </div>
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon submission-ai">
                                <SafetyOutlined />
                            </div>
                            <div className="placeholder-benefit-title">Strengthen Submission</div>
                            <div className="placeholder-benefit-description">
                                Identify weak spots and gaps in your documentation that reviewers might flag.
                            </div>
                        </div>
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon submission-ai">
                                <CheckCircleOutlined />
                            </div>
                            <div className="placeholder-benefit-title">Reduce IR Cycles</div>
                            <div className="placeholder-benefit-description">
                                Minimize back-and-forth with FDA by addressing concerns proactively.
                            </div>
                        </div>
                    </div>
                </div>

                <div className="placeholder-coming-soon">
                    <div className="placeholder-coming-soon-icon">🚀</div>
                    <div className="placeholder-coming-soon-title">Coming Soon!</div>
                    <div className="placeholder-coming-soon-text">
                        This feature is under active development. Stay tuned for updates!
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FDAReviewerPreviewTab;
