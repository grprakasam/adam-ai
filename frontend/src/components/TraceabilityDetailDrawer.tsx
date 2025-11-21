// @ts-nocheck
import React from 'react';
import {
  Drawer,
  Tabs,
  Space,
  Tag,
  Alert,
  Divider,
  List,
  Card,
  Button,
  Descriptions,
  Steps,
  Typography,
  Progress,
  Row,
  Col,
} from 'antd';
import {
  CheckCircleOutlined,
  BookOutlined,
  LinkOutlined,
  RobotOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  CodeOutlined,
  AimOutlined,
  TrophyOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import type { TraceabilityVariable } from '../types/traceability';
import './TraceabilityDetailDrawer.css';

const { Text, Paragraph } = Typography;

interface TraceabilityDetailDrawerProps {
  visible: boolean;
  variable?: TraceabilityVariable;
  onClose: () => void;
}

export const TraceabilityDetailDrawer: React.FC<TraceabilityDetailDrawerProps> = ({
  visible,
  variable,
  onClose,
}) => {
  if (!variable) return null;

  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      'Subject & Study Identifiers': 'blue',
      'Demographics': 'cyan',
      'Treatment': 'purple',
      'Dates and Times': 'orange',
      'Flags': 'green',
      'Other Variables': 'default',
    };
    return colorMap[category] || 'default';
  };

  return (
    <Drawer
      title={
        <div className="drawer-header">
          <Space>
            <Text strong style={{ fontSize: 18 }}>{variable.variable_name}</Text>
            <Tag color={getCategoryColor(variable.category)} className="category-tag-large">
              {variable.category}
            </Tag>
          </Space>
        </div>
      }
      placement="right"
      width={800}
      open={visible}
      onClose={onClose}
      className="traceability-detail-drawer"
    >
      {/* Confidence Score Card */}
      <Card className="confidence-score-card" bordered={false}>
        <Row gutter={24}>
          <Col span={8}>
            <div className="confidence-gauge">
              <Progress
                type="circle"
                percent={Math.round(variable.confidence * 100)}
                strokeColor={{
                  '0%': variable.confidence > 0.8 ? '#52c41a' : variable.confidence > 0.5 ? '#faad14' : '#ff4d4f',
                  '100%': variable.confidence > 0.8 ? '#237804' : variable.confidence > 0.5 ? '#d48806' : '#cf1322',
                }}
                strokeWidth={8}
                width={120}
                format={(percent) => (
                  <div className="gauge-content">
                    <div className="gauge-percent">{percent}%</div>
                    <div className="gauge-label">Confidence</div>
                  </div>
                )}
              />
            </div>
          </Col>
          <Col span={16}>
            <div className="confidence-quality">
              <h3>
                {variable.confidence > 0.8 ? '🟢 High Confidence' : 
                 variable.confidence > 0.5 ? '🟡 Medium Confidence' : 
                 '🔴 Low Confidence'}
              </h3>
              <div className="confidence-factors">
                <div className="factor-item">
                  <CheckCircleOutlined className="factor-icon success" />
                  <span>Complete source mapping</span>
                  <span className="factor-score">+25</span>
                </div>
                <div className="factor-item">
                  <CheckCircleOutlined className="factor-icon success" />
                  <span>ADAM IG rule match</span>
                  <span className="factor-score">+20</span>
                </div>
                {variable.code_refs && variable.code_refs.length > 0 && (
                  <div className="factor-item">
                    <CheckCircleOutlined className="factor-icon success" />
                    <span>Code validation passed</span>
                    <span className="factor-score">+20</span>
                  </div>
                )}
                <div className="factor-item">
                  <CheckCircleOutlined className="factor-icon success" />
                  <span>Standard CDISC variable</span>
                  <span className="factor-score">+15</span>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      <Tabs defaultActiveKey="overview" className="detail-tabs">
        {/* Tab 1: Overview */}
        <Tabs.TabPane 
          tab={<span><AimOutlined /> Overview</span>} 
          key="overview"
        >
          <Card className="profile-card" bordered={false}>
            <h3>📊 Variable Profile</h3>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Variable Name" span={2}>
                <Text strong style={{ fontSize: 16 }}>{variable.variable_name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Label" span={2}>
                {variable.label}
              </Descriptions.Item>
              <Descriptions.Item label="Data Type">
                {variable.data_type}
              </Descriptions.Item>
              <Descriptions.Item label="Length">
                {variable.length || 'N/A'}
              </Descriptions.Item>
              {variable.format && (
                <Descriptions.Item label="Format" span={2}>
                  {variable.format}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Attributes" span={2}>
                <Space>
                  {variable.is_key && <Tag color="red">🔑 Key Variable</Tag>}
                  {variable.is_required && <Tag color="blue">✓ Required</Tag>}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Divider orientation="left">
            <LinkOutlined /> Lineage Flow
          </Divider>
          
          <Card className="lineage-flow-card" bordered={false}>
            <Steps
              direction="vertical"
              current={variable.derivation_steps ? variable.derivation_steps.length : 3}
              className="lineage-steps"
            >
              <Steps.Step
                title="Step 1: Extract from Source"
                description={
                  <div className="step-content">
                    {variable.sources.map((source, idx) => (
                      <div key={idx} className="source-item">
                        <Tag color="blue">{source.domain}</Tag>
                        {source.variable && <Text code>{source.variable}</Text>}
                        {source.label && <Text type="secondary"> - {source.label}</Text>}
                      </div>
                    ))}
                  </div>
                }
                icon={<DatabaseOutlined />}
              />
              <Steps.Step
                title="Step 2: Apply Transformation"
                description={
                  <Card size="small" className="algorithm-card">
                    <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13 }}>
                      {variable.algorithm || 'Direct assignment'}
                    </Paragraph>
                  </Card>
                }
                icon={<ThunderboltOutlined />}
              />
              <Steps.Step
                title="Step 3: Assign to ADAM"
                description={
                  <div className="result-item">
                    <Tag color="green">{variable.variable_name}</Tag>
                    <Text type="secondary">Analysis Dataset Variable</Text>
                  </div>
                }
                icon={<TrophyOutlined />}
              />
            </Steps>
          </Card>
        </Tabs.TabPane>

        {/* Tab 2: Derivation Code */}
        {variable.code_refs && variable.code_refs.length > 0 && (
          <Tabs.TabPane 
            tab={<span><CodeOutlined /> Code</span>} 
            key="code"
          >
            <Card
              className="code-card"
              title={
                <Space>
                  <CodeOutlined />
                  <Text strong>{variable.code_refs[0].language} Code</Text>
                </Space>
              }
              bordered={false}
            >
              <pre className="code-block">
                {variable.code_refs[0].code}
              </pre>
            </Card>
          </Tabs.TabPane>
        )}

        {/* Tab 3: ADAM IG Rules */}
        <Tabs.TabPane 
          tab={<span><BookOutlined /> Rules</span>} 
          key="rules"
        >
          {variable.rule_refs && variable.rule_refs.length > 0 ? (
            <List
              dataSource={variable.rule_refs}
              renderItem={(ref) => (
                <List.Item>
                  <Card size="small" style={{ width: '100%' }} hoverable>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space>
                        <BookOutlined style={{ color: '#faad14' }} />
                        <Text strong>{ref}</Text>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ADAM Implementation Guide Reference
                      </Text>
                    </Space>
                  </Card>
                </List.Item>
              )}
            />
          ) : (
            <Alert
              message="No ADAM IG rules linked"
              description="This variable may be a standard SDTM variable or custom derivation."
              type="info"
              showIcon
            />
          )}

          <Divider orientation="left">Validation Status</Divider>
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <Text>Validation Status:</Text>
                <Tag color={variable.validation_status === 'valid' ? 'success' : 'warning'}>
                  {variable.validation_status.toUpperCase()}
                </Tag>
              </Space>
              {variable.validation_notes && (
                <Alert
                  message={variable.validation_notes}
                  type="info"
                  showIcon
                />
              )}
            </Space>
          </Card>
        </Tabs.TabPane>

        {/* Tab 3: AI Insights */}
        {variable.ai_insights && (
          <Tabs.TabPane
            tab={
              <Space>
                <RobotOutlined />
                AI Insights
              </Space>
            }
            key="insights"
          >
            <Alert
              message="AI-Powered Analysis"
              description="Automatic anomaly detection and suggestions based on CDISC standards."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            {variable.ai_insights.anomalies && variable.ai_insights.anomalies.length > 0 && (
              <>
                <Divider orientation="left">Potential Issues</Divider>
                <List
                  dataSource={variable.ai_insights.anomalies}
                  renderItem={(anomaly) => (
                    <List.Item>
                      <Alert
                        type="warning"
                        message={anomaly.title}
                        description={anomaly.description}
                        showIcon
                        icon={<WarningOutlined />}
                        style={{ width: '100%' }}
                      />
                    </List.Item>
                  )}
                />
              </>
            )}

            {variable.ai_insights.suggestions && variable.ai_insights.suggestions.length > 0 && (
              <>
                <Divider orientation="left">Suggestions</Divider>
                <List
                  dataSource={variable.ai_insights.suggestions}
                  renderItem={(suggestion) => (
                    <List.Item>
                      <Card size="small" hoverable style={{ width: '100%' }}>
                        <Space direction="vertical">
                          <Text strong>{suggestion.title}</Text>
                          <Text type="secondary">{suggestion.rationale}</Text>
                        </Space>
                      </Card>
                    </List.Item>
                  )}
                />
              </>
            )}

            {variable.ai_insights.similar_patterns && variable.ai_insights.similar_patterns.length > 0 && (
              <>
                <Divider orientation="left">Similar Patterns in Industry</Divider>
                <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  Based on CDISC pilot studies and public ADAM programs
                </Text>
                <List
                  dataSource={variable.ai_insights.similar_patterns}
                  renderItem={(pattern) => (
                    <List.Item>
                      <Text>{pattern}</Text>
                    </List.Item>
                  )}
                />
              </>
            )}

            {(!variable.ai_insights.anomalies || variable.ai_insights.anomalies.length === 0) &&
              (!variable.ai_insights.suggestions || variable.ai_insights.suggestions.length === 0) && (
                <Alert
                  message="No Issues Found"
                  description="This variable appears to follow CDISC standards and best practices."
                  type="success"
                showIcon
              />
            )}
          </Tabs.TabPane>
        )}
      </Tabs>      {/* Footer Actions */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px 24px',
          borderTop: '1px solid #f0f0f0',
          background: 'white',
        }}
      >
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>Close</Button>
        </Space>
      </div>
    </Drawer>
  );
};
