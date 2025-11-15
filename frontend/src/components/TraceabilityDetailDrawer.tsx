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
} from 'antd';
import {
  CheckCircleOutlined,
  BookOutlined,
  LinkOutlined,
  RobotOutlined,
  MessageOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import type { TraceabilityVariable } from '../types/traceability';

const { Text, Paragraph } = Typography;
const { TabPane } = Tabs;

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

  const getConfidenceAlertType = (confidence: number) => {
    if (confidence > 0.8) return 'success';
    if (confidence > 0.5) return 'warning';
    return 'error';
  };

  return (
    <Drawer
      title={
        <Space>
          <Text strong>{variable.variable_name}</Text>
          <Tag color={getCategoryColor(variable.category)}>
            {variable.category}
          </Tag>
        </Space>
      }
      placement="right"
      width={700}
      open={visible}
      onClose={onClose}
    >
      <Tabs defaultActiveKey="derivation">
        {/* Tab 1: Derivation Details */}
        <TabPane tab="Derivation" key="derivation">
          <Alert
            message={`Confidence: ${Math.round(variable.confidence * 100)}%`}
            type={getConfidenceAlertType(variable.confidence)}
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Variable Name">
              {variable.variable_name}
            </Descriptions.Item>
            <Descriptions.Item label="Label">
              {variable.label}
            </Descriptions.Item>
            <Descriptions.Item label="Data Type">
              {variable.data_type}
              {variable.length && ` (${variable.length})`}
            </Descriptions.Item>
            {variable.format && (
              <Descriptions.Item label="Format">
                {variable.format}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Attributes">
              <Space>
                {variable.is_key && <Tag color="red">Key Variable</Tag>}
                {variable.is_required && <Tag color="blue">Required</Tag>}
              </Space>
            </Descriptions.Item>
          </Descriptions>

          <Divider orientation="left">Source Variables</Divider>
          <List
            size="small"
            dataSource={variable.sources}
            renderItem={(source) => (
              <List.Item>
                <Space>
                  <Tag color="blue">{source.domain}</Tag>
                  <Text code>{source.variable}</Text>
                  {source.label && (
                    <Text type="secondary">- {source.label}</Text>
                  )}
                </Space>
              </List.Item>
            )}
            locale={{ emptyText: 'No source variables identified' }}
          />

          <Divider orientation="left">Transformation Logic</Divider>
          <Card size="small" style={{ background: '#fafafa' }}>
            <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {variable.algorithm || 'No algorithm specified'}
            </Paragraph>
          </Card>

          {variable.code_refs && variable.code_refs.length > 0 && (
            <>
              <Divider orientation="left">Code Snippet</Divider>
              <Card
                size="small"
                title={
                  <Space>
                    <CodeOutlined />
                    {variable.code_refs[0].language}
                  </Space>
                }
              >
                <pre
                  style={{
                    background: '#f6f6f6',
                    padding: 12,
                    borderRadius: 4,
                    overflow: 'auto',
                    maxHeight: 300,
                    fontSize: 12,
                    margin: 0,
                  }}
                >
                  {variable.code_refs[0].code}
                </pre>
              </Card>
            </>
          )}

          {variable.derivation_steps && variable.derivation_steps.length > 0 && (
            <>
              <Divider orientation="left">Derivation Steps</Divider>
              <Steps
                direction="vertical"
                size="small"
                current={-1}
                items={variable.derivation_steps.map((step) => ({
                  title: step.operation,
                  description: step.detail,
                  icon: <CheckCircleOutlined />,
                }))}
              />
            </>
          )}
        </TabPane>

        {/* Tab 2: ADAM IG Rules */}
        <TabPane tab="Rules & Standards" key="rules">
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
        </TabPane>

        {/* Tab 3: AI Insights */}
        {variable.ai_insights && (
          <TabPane
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
          </TabPane>
        )}
      </Tabs>

      {/* Footer Actions */}
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
