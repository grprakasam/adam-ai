import { Card, Typography, Space, Tag } from 'antd';
import { RobotOutlined, ThunderboltFilled } from '@ant-design/icons';
import { PageHeader } from './PageHeader';
import './AgenticAITab.css';

const { Title, Text, Paragraph } = Typography;

export const AgenticAITab = () => {
    return (
        <div className="agentic-ai-container">
            {/* Blue Header */}
            <PageHeader
                title="Agentic AI"
                subtitle="Autonomous AI agents for complex ADAM tasks"
                icon={<RobotOutlined />}
                actions={<Tag color="purple">Preview</Tag>}
            />

            {/* Coming Soon Content */}
            <Card className="agentic-coming-soon-card">
                <div className="agentic-hero-icon">
                    <ThunderboltFilled />
                </div>
                <Title level={3}>Autonomous Intelligence</Title>
                <Paragraph className="agentic-description">
                    Deploy specialized AI agents that can autonomously analyze specifications,
                    generate complex code structures, and validate outputs with minimal human intervention.
                    The future of clinical programming is agentic.
                </Paragraph>

                <div className="capabilities-grid">
                    <div className="capability-card">
                        <div className="cap-icon">🔍</div>
                        <Title level={5}>Auto-Analysis</Title>
                        <Text type="secondary">Agents that read and understand complex protocols and SAPs automatically.</Text>
                    </div>

                    <div className="capability-card">
                        <div className="cap-icon">⚙️</div>
                        <div className="cap-content">
                            <Title level={5}>Self-Healing Code</Title>
                            <Text type="secondary">Generation engines that detect errors and fix their own code iteratively.</Text>
                        </div>
                    </div>

                    <div className="capability-card">
                        <div className="cap-icon">🔄</div>
                        <Title level={5}>Workflow Automation</Title>
                        <Text type="secondary">End-to-end automation from raw data to final ADAM datasets.</Text>
                    </div>

                    <div className="capability-card">
                        <div className="cap-icon">🛡️</div>
                        <Title level={5}>Guardrails</Title>
                        <Text type="secondary">Built-in safety checks ensuring all agent actions are compliant and safe.</Text>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default AgenticAITab;
