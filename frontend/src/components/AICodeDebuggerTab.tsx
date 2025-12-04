import { Typography } from 'antd';
import {
    BugOutlined,
    ThunderboltOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CodeOutlined,
    FileTextOutlined,
} from '@ant-design/icons';
import './PlaceholderFeature.css';

const { Title, Text } = Typography;

const AICodeDebuggerTab = () => {
    return (
        <div className="placeholder-feature-container">
            <div className="placeholder-feature-header">
                <div className="placeholder-feature-icon coding-ai">
                    <BugOutlined />
                </div>
                <Title level={2} className="placeholder-feature-title">
                    AI Code Debugger
                </Title>
                <Text className="placeholder-feature-tagline">
                    Paste an error log, AI explains root cause and suggests fix
                </Text>
                <div className="placeholder-feature-status">
                    <ClockCircleOutlined />
                    Coming Soon - Preview Mode
                </div>
            </div>

            <div className="placeholder-feature-content">
                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <BugOutlined style={{ color: '#f5222d' }} />
                        What is AI Code Debugger?
                    </Title>
                    <div className="placeholder-feature-section-content">
                        <p>
                            The AI Code Debugger is your intelligent assistant for understanding and resolving
                            programming errors in SAS and R code. Simply paste your error log, and our AI will
                            analyze the root cause in plain English and suggest targeted fixes.
                        </p>
                        <p>
                            This tool is specifically designed for clinical programming workflows, understanding
                            ADAM, SDTM, and TLF programming contexts to provide relevant and accurate debugging
                            assistance.
                        </p>
                    </div>
                </div>

                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <CodeOutlined style={{ color: '#f5222d' }} />
                        Example Usage
                    </Title>
                    <div className="placeholder-feature-section-content">
                        <p>Paste an error like this:</p>
                        <div className="placeholder-feature-example coding-ai">
                            ERROR: Variable TRTSDT is uninitialized.<br />
                            NOTE: Missing values were generated as a result of performing an operation on missing values.<br />
                            PROC TRANSPOSE at line 45, column 8.
                        </div>
                        <p style={{ marginTop: '16px' }}>AI will explain:</p>
                        <div className="placeholder-feature-example coding-ai">
                            <strong>Root Cause:</strong> The error is on line 45: TRTSDT is NULL because EXSTDTC has
                            missing values for 12 subjects in the source data.<br /><br />
                            <strong>Suggested Fix:</strong> Apply COALESCE with RFSTDTC as fallback:<br />
                            <code>TRTSDT = COALESCE(input(EXSTDTC, yymmdd10.), RFSTDTC);</code>
                        </div>
                    </div>
                </div>

                <div className="placeholder-feature-section">
                    <Title level={4} className="placeholder-feature-section-title">
                        <ThunderboltOutlined style={{ color: '#f5222d' }} />
                        Key Benefits
                    </Title>
                    <div className="placeholder-feature-benefits">
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon coding-ai">
                                <CheckCircleOutlined />
                            </div>
                            <div className="placeholder-benefit-title">Plain English Explanations</div>
                            <div className="placeholder-benefit-description">
                                No more cryptic error messages. Get clear, understandable explanations of what went wrong.
                            </div>
                        </div>
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon coding-ai">
                                <FileTextOutlined />
                            </div>
                            <div className="placeholder-benefit-title">Context-Aware Fixes</div>
                            <div className="placeholder-benefit-description">
                                AI understands clinical programming context and suggests fixes specific to ADAM/SDTM workflows.
                            </div>
                        </div>
                        <div className="placeholder-benefit-card">
                            <div className="placeholder-benefit-icon coding-ai">
                                <ThunderboltOutlined />
                            </div>
                            <div className="placeholder-benefit-title">Faster Resolution</div>
                            <div className="placeholder-benefit-description">
                                Reduce debugging time by 70% with instant AI-powered error analysis and solutions.
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

export default AICodeDebuggerTab;
