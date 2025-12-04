import { Card, Typography } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import './ADAMTutorTab.css';

const { Title, Text, Paragraph } = Typography;

export const ADAMTutorTab = () => {
    return (
        <div className="adam-tutor-container">
            {/* Header */}
            <div className="tutor-header">
                <div className="tutor-icon-wrapper">
                    <BookOutlined className="tutor-icon" />
                </div>
                <div>
                    <Title level={2} style={{ margin: 0 }}>ADAM Tutor</Title>
                    <Text type="secondary">Learn ADAM programming with interactive tutorials</Text>
                </div>
            </div>

            {/* Coming Soon Content */}
            <Card className="tutor-coming-soon-card">
                <div className="coming-soon-badge">Coming Soon</div>
                <Title level={3}>Interactive Learning Platform</Title>
                <Paragraph className="tutor-description">
                    We are building a comprehensive educational platform to master ADAM dataset creation.
                    This feature will include step-by-step tutorials, CDISC compliance guides, and
                    interactive coding exercises tailored for clinical data programmers.
                </Paragraph>

                <div className="features-preview">
                    <Title level={5}>Planned Modules:</Title>
                    <ul className="feature-list">
                        <li>
                            <span className="feature-bullet">📚</span>
                            <span><strong>ADAM Fundamentals:</strong> Understanding structure and core variables</span>
                        </li>
                        <li>
                            <span className="feature-bullet">🧩</span>
                            <span><strong>Dataset Creation:</strong> Step-by-step guides for ADSL, ADAE, and more</span>
                        </li>
                        <li>
                            <span className="feature-bullet">✅</span>
                            <span><strong>Compliance Checks:</strong> Interactive CDISC rule validation</span>
                        </li>
                        <li>
                            <span className="feature-bullet">🎓</span>
                            <span><strong>Certification:</strong> Track your progress and earn badges</span>
                        </li>
                    </ul>
                </div>
            </Card>
        </div>
    );
};

export default ADAMTutorTab;
