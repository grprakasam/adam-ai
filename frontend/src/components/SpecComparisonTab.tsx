import { Typography } from 'antd';
import {
    DiffOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    SwapOutlined,
    HistoryOutlined,
    EyeOutlined,
} from '@ant-design/icons';
import './PlaceholderFeature.css';

const { Title, Text } = Typography;

const SpecComparisonTab = () => {
    return (
        <div className="placeholder-feature-container">
            <div className="placeholder-feature-header">
                <div className="placeholder-feature-icon specifications-ai">
                    <DiffOutlined />
                </div>
                <Title level={2} className="placeholder-feature-title">
                    Spec-to-Spec Comparison
                </Title>
                <Text className="placeholder-feature-tagline">
                    Upload two spec versions, AI highlights semantic differences
                </Text>
                <div className="placeholder-feature-status">
                    <ClockCircleOutlined />
                    Coming Soon - Preview Mode
                </div>
            </div>

            <div className="placeholder-feature-content">
                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <DiffOutlined style={{ color: '#faad14' }} />
                        What is Spec-to-Spec Comparison?
                    </Title>
                    <div className="placeholder-feature-section-content">
                        <p>
                            The Spec-to-Spec Comparison tool uses AI to analyze two versions of a specification
                            document and highlights not just textual changes, but <strong>semantic differences</strong>
                            that could impact your programming.
                        </p>
                        <p>
                            Unlike simple diff tools, our AI understands the context of clinical programming
                            specifications and explains what changed and why it matters for your ADAM/TLF development.
                        </p>
                    </div>
                </div>

                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <SwapOutlined style={{ color: '#faad14' }} />
                        Example Comparison
                    </Title>
                    <div className="placeholder-feature-section-content">
                        <p>Upload two versions of your ADAM specification. AI will identify changes like:</p>
                        <div className="placeholder-feature-example specifications-ai">
                            <strong>📊 Semantic Change Detected:</strong><br /><br />
                            Variable: <code>AGEGR1</code> (Age Group)<br /><br />
                            <strong>Version 1.0:</strong><br />
                            Categories: &lt;18, 18-65, &gt;65<br /><br />
                            <strong>Version 2.0:</strong><br />
                            Categories: &lt;18, 18-50, 50-65, &gt;65<br /><br />
                            <strong>Impact Analysis:</strong><br />
                            - Added new category "50-65" (splits previous 18-65 group)<br />
                            - 127 subjects will be reclassified from "18-65" to new categories<br />
                            - TLF tables using AGEGR1 need to be updated<br />
                            - Statistical analysis plans may need revision
                        </div>
                    </div>
                </div>

                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <EyeOutlined style={{ color: '#faad14' }} />
                        Key Benefits
                    </Title>
                    <div className="placeholder-feature-benefits">
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon specifications-ai">
                                <DiffOutlined />
                            </div>
                            <div className="placeholder-benefit-title">Semantic Understanding</div>
                            <div className="placeholder-benefit-description">
                                Goes beyond text differences to understand what changes mean for your programs.
                            </div>
                        </div>
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon specifications-ai">
                                <HistoryOutlined />
                            </div>
                            <div className="placeholder-benefit-title">Version Tracking</div>
                            <div className="placeholder-benefit-description">
                                Track specification evolution and understand the impact of each version change.
                            </div>
                        </div>
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon specifications-ai">
                                <CheckCircleOutlined />
                            </div>
                            <div className="placeholder-benefit-title">Impact Assessment</div>
                            <div className="placeholder-benefit-description">
                                Get automatic assessment of which programs and outputs need updates.
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

export default SpecComparisonTab;
