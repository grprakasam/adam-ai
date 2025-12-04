import { Typography } from 'antd';
import {
    AuditOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    FolderOutlined,
    FileTextOutlined,
    SafetyOutlined,
} from '@ant-design/icons';
import './PlaceholderFeature.css';

const { Title, Text } = Typography;

const ESubmissionCheckerTab = () => {
    return (
        <div className="placeholder-feature-container">
            <div className="placeholder-feature-header">
                <div className="placeholder-feature-icon submission-ai">
                    <AuditOutlined />
                </div>
                <Title level={2} className="placeholder-feature-title">
                    eSubmission Readiness Checker
                </Title>
                <Text className="placeholder-feature-tagline">
                    One-click FDA eSubmission conformance scan
                </Text>
                <div className="placeholder-feature-status">
                    <ClockCircleOutlined />
                    Coming Soon - Preview Mode
                </div>
            </div>

            <div className="placeholder-feature-content">
                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <AuditOutlined style={{ color: '#13c2c2' }} />
                        What is eSubmission Readiness Checker?
                    </Title>
                    <div className="placeholder-feature-section-content">
                        <p>
                            The eSubmission Readiness Checker performs a comprehensive one-click scan of your
                            submission package against FDA's eSubmission Technical Conformance Guide requirements.
                            It validates file sizes, folder structure, naming conventions, and format compliance.
                        </p>
                        <p>
                            Avoid common rejection reasons by catching technical issues before you submit.
                            Our AI validates all aspects of the eCTD structure and CDISC data package requirements.
                        </p>
                    </div>
                </div>

                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <FileTextOutlined style={{ color: '#13c2c2' }} />
                        Example Validation Report
                    </Title>
                    <div className="placeholder-feature-section-content">
                        <p>Run a scan and get a comprehensive report:</p>
                        <div className="placeholder-feature-example submission-ai">
                            <strong>📋 eSubmission Readiness Report</strong><br /><br />
                            <strong>✅ Folder Structure:</strong> Compliant with eCTD v4.0<br />
                            <strong>✅ File Naming:</strong> All files follow conventions<br />
                            <strong>⚠️ File Size:</strong> 2 files exceed recommended limit<br />
                            &nbsp;&nbsp;- m5/datasets/analysis/adam/adsl.xpt (105 MB)<br />
                            &nbsp;&nbsp;- m5/datasets/analysis/adam/adae.xpt (89 MB)<br />
                            <strong>✅ PDF Formatting:</strong> All PDFs are compliant<br />
                            <strong>✅ Dataset Compliance:</strong> XPT v5 format verified<br /><br />
                            <strong>Recommendation:</strong> Consider splitting large XPT files or
                            providing split dataset documentation per FDA guidance.
                        </div>
                    </div>
                </div>

                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <SafetyOutlined style={{ color: '#13c2c2' }} />
                        Key Benefits
                    </Title>
                    <div className="placeholder-feature-benefits">
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon submission-ai">
                                <CheckCircleOutlined />
                            </div>
                            <div className="placeholder-benefit-title">One-Click Validation</div>
                            <div className="placeholder-benefit-description">
                                Comprehensive technical conformance check with a single click. No manual review needed.
                            </div>
                        </div>
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon submission-ai">
                                <FolderOutlined />
                            </div>
                            <div className="placeholder-benefit-title">Structure Verification</div>
                            <div className="placeholder-benefit-description">
                                Validates eCTD folder structure, file naming, and organization against FDA requirements.
                            </div>
                        </div>
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon submission-ai">
                                <AuditOutlined />
                            </div>
                            <div className="placeholder-benefit-title">Avoid Rejections</div>
                            <div className="placeholder-benefit-description">
                                Catch technical issues before submission to avoid costly delays and resubmissions.
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

export default ESubmissionCheckerTab;
