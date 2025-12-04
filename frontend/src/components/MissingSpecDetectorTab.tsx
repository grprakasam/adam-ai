import { Typography } from 'antd';
import {
    FileSearchOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    ExclamationCircleOutlined,
    DatabaseOutlined,
    SafetyOutlined,
} from '@ant-design/icons';
import './PlaceholderFeature.css';

const { Title, Text } = Typography;

const MissingSpecDetectorTab = () => {
    return (
        <div className="placeholder-feature-container">
            <div className="placeholder-feature-header">
                <div className="placeholder-feature-icon specifications-ai">
                    <FileSearchOutlined />
                </div>
                <Title level={2} className="placeholder-feature-title">
                    Missing Spec Detector
                </Title>
                <Text className="placeholder-feature-tagline">
                    Upload dataset + specification Excel, AI flags discrepancies
                </Text>
                <div className="placeholder-feature-status">
                    <ClockCircleOutlined />
                    Coming Soon - Preview Mode
                </div>
            </div>

            <div className="placeholder-feature-content">
                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <FileSearchOutlined style={{ color: '#faad14' }} />
                        What is Missing Spec Detector?
                    </Title>
                    <div className="placeholder-feature-section-content">
                        <p>
                            The Missing Spec Detector is an intelligent validation tool that compares your
                            dataset against its specification document. It automatically identifies discrepancies,
                            missing values, and specification violations that could cause issues during submission.
                        </p>
                        <p>
                            Save hours of manual review by letting AI analyze the alignment between your
                            ADAM/SDTM datasets and their corresponding specifications.
                        </p>
                    </div>
                </div>

                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                        Example Detection
                    </Title>
                    <div className="placeholder-feature-section-content">
                        <p>Upload your dataset and specification Excel. AI will detect issues like:</p>
                        <div className="placeholder-feature-example specifications-ai">
                            <strong>🔍 Discrepancy Found:</strong><br /><br />
                            Variable: <code>AGE</code><br />
                            Specification: Required (no missing values allowed)<br />
                            Dataset Status: 5 missing values detected<br /><br />
                            <strong>Affected Subjects:</strong> SUBJ-001, SUBJ-045, SUBJ-078, SUBJ-102, SUBJ-156<br /><br />
                            <strong>Recommendation:</strong> Review source data (DM domain) for these subjects
                            or update specification to allow missing values with appropriate justification.
                        </div>
                    </div>
                </div>

                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <SafetyOutlined style={{ color: '#faad14' }} />
                        Key Benefits
                    </Title>
                    <div className="placeholder-feature-benefits">
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon specifications-ai">
                                <CheckCircleOutlined />
                            </div>
                            <div className="placeholder-benefit-title">Automated Validation</div>
                            <div className="placeholder-benefit-description">
                                Automatically compare datasets against specs to catch discrepancies before submission.
                            </div>
                        </div>
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon specifications-ai">
                                <DatabaseOutlined />
                            </div>
                            <div className="placeholder-benefit-title">Comprehensive Checks</div>
                            <div className="placeholder-benefit-description">
                                Validates variable presence, data types, value ranges, and required field compliance.
                            </div>
                        </div>
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon specifications-ai">
                                <SafetyOutlined />
                            </div>
                            <div className="placeholder-benefit-title">Submission Ready</div>
                            <div className="placeholder-benefit-description">
                                Ensure your datasets align with specifications before FDA/EMA submission.
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

export default MissingSpecDetectorTab;
