import { Card, Typography } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import { PageHeader } from './PageHeader';
import './ADAMTutorTab.css';

const { Title, Text, Paragraph } = Typography;

export const ADAMTutorTab = () => {
    return (
        <div className="adam-tutor-container">
            {/* Blue Header */}
            <PageHeader
                title="ADAM Tutor"
                subtitle="Learn ADAM programming with interactive tutorials"
                icon={<BookOutlined />}
            />

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
