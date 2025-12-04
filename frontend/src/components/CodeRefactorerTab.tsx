import { Typography } from 'antd';
import {
    ThunderboltOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CodeOutlined,
    RocketOutlined,
    BarChartOutlined,
} from '@ant-design/icons';
import './PlaceholderFeature.css';

const { Title, Text } = Typography;

const CodeRefactorerTab = () => {
    return (
        <div className="placeholder-feature-container">
            <div className="placeholder-feature-header">
                <div className="placeholder-feature-icon coding-ai">
                    <ThunderboltOutlined />
                </div>
                <Title level={2} className="placeholder-feature-title">
                    Code Refactorer / Optimizer
                </Title>
                <Text className="placeholder-feature-tagline">
                    Upload a SAS/R script, AI suggests optimizations for better performance
                </Text>
                <div className="placeholder-feature-status">
                    <ClockCircleOutlined />
                    Coming Soon - Preview Mode
                </div>
            </div>

            <div className="placeholder-feature-content">
                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <CodeOutlined style={{ color: '#f5222d' }} />
                        What is Code Refactorer/Optimizer?
                    </Title>
                    <div className="placeholder-feature-section-content">
                        <p>
                            The Code Refactorer/Optimizer analyzes your SAS or R scripts and suggests
                            improvements for better performance, readability, and maintainability.
                            Get AI-powered recommendations specific to clinical programming best practices.
                        </p>
                        <p>
                            Whether you're working with large datasets or complex transformations,
                            our AI identifies bottlenecks and suggests optimized code patterns.
                        </p>
                    </div>
                </div>

                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <RocketOutlined style={{ color: '#f5222d' }} />
                        Example Optimization
                    </Title>
                    <div className="placeholder-feature-section-content">
                        <p>Upload code with performance issues:</p>
                        <div className="placeholder-feature-example coding-ai">
                            data ADSL;<br />
                            &nbsp;&nbsp;set SDTM.DM;<br />
                            &nbsp;&nbsp;do i = 1 to nobs;<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;set SDTM.EX point=i nobs=nobs;<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;if USUBJID = USUBJID then do;<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;/* nested processing */<br />
                            &nbsp;&nbsp;&nbsp;&nbsp;end;<br />
                            &nbsp;&nbsp;end;<br />
                            run;
                        </div>
                        <p style={{ marginTop: '16px' }}>AI suggests:</p>
                        <div className="placeholder-feature-example coding-ai">
                            <strong>Optimization:</strong> Replace the nested DO loop with a HASH object
                            for 30% faster execution.<br /><br />
                            <code>
                                data ADSL;<br />
                                &nbsp;&nbsp;if _n_ = 1 then do;<br />
                                &nbsp;&nbsp;&nbsp;&nbsp;declare hash h(dataset: 'SDTM.EX');<br />
                                &nbsp;&nbsp;&nbsp;&nbsp;h.defineKey('USUBJID');<br />
                                &nbsp;&nbsp;&nbsp;&nbsp;h.defineData(...);<br />
                                &nbsp;&nbsp;&nbsp;&nbsp;h.defineDone();<br />
                                &nbsp;&nbsp;end;<br />
                                &nbsp;&nbsp;set SDTM.DM;<br />
                                &nbsp;&nbsp;rc = h.find();<br />
                                run;
                            </code>
                        </div>
                    </div>
                </div>

                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <BarChartOutlined style={{ color: '#f5222d' }} />
                        Key Benefits
                    </Title>
                    <div className="placeholder-feature-benefits">
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon coding-ai">
                                <RocketOutlined />
                            </div>
                            <div className="placeholder-benefit-title">Performance Boost</div>
                            <div className="placeholder-benefit-description">
                                Identify slow code patterns and get recommendations for 30-50% faster execution.
                            </div>
                        </div>
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon coding-ai">
                                <CheckCircleOutlined />
                            </div>
                            <div className="placeholder-benefit-title">Best Practices</div>
                            <div className="placeholder-benefit-description">
                                Ensure your code follows industry standards and clinical programming best practices.
                            </div>
                        </div>
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon coding-ai">
                                <CodeOutlined />
                            </div>
                            <div className="placeholder-benefit-title">Cleaner Code</div>
                            <div className="placeholder-benefit-description">
                                Get suggestions for improved readability and maintainability of your scripts.
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

export default CodeRefactorerTab;
