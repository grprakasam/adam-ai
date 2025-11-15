/**
 * My Validation Tab
 *
 * Pre-generation review and approval checklist for ADAM variables.
 * Users can review variable derivations, approve/modify status, and regenerate code.
 */

import React, { useState, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Radio,
  Space,
  Badge,
  Tooltip,
  Alert,
  Progress,
  Typography,
  Tag,
  Modal,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useProjectStore } from '../store/projectStore';
import './MyValidationTab.css';

const { Title, Text } = Typography;

export const MyValidationTab: React.FC = () => {
  const {
    categorizedVariables,
    pairProgramming,
    setPairProgrammingAcceptance,
  } = useProjectStore();

  const [viewCodeModal, setViewCodeModal] = useState<{
    visible: boolean;
    variable?: string;
    code?: string;
    rationale?: string;
  }>({ visible: false });

  // Calculate approval statistics
  const approvalStats = useMemo(() => {
    const snippets = Object.values(pairProgramming.snippets);
    const total = snippets.length;
    const accepted = snippets.filter(s => s.accepted === 'accept').length;
    const modified = snippets.filter(s => s.accepted === 'modify').length;
    const pending = total - accepted - modified;
    const percentage = total > 0 ? Math.round((accepted / total) * 100) : 0;

    return { total, accepted, modified, pending, percentage };
  }, [pairProgramming.snippets]);

  // Prepare table data
  const tableData = useMemo(() => {
    if (!categorizedVariables?.categories) return [];

    const data: any[] = [];

    categorizedVariables.categories.forEach(category => {
      category.variables.forEach(variable => {
        const snippet = pairProgramming.snippets[variable.name];

        data.push({
          key: variable.name,
          variableName: variable.name,
          category: category.name,
          type: variable.type || 'N/A',
          required: variable.required,
          derivation: variable.derivation || variable.label || '-',
          hasSnippet: !!snippet,
          snippetStatus: snippet ? (snippet.error ? 'error' : 'generated') : 'not_generated',
          acceptance: snippet?.accepted || null,
          error: snippet?.error,
          codeSnippet: snippet?.codeSnippet,
          rationale: snippet?.rationale,
        });
      });
    });

    return data;
  }, [categorizedVariables, pairProgramming.snippets]);

  // Handle approval change
  const handleApprovalChange = (variable: string, acceptance: 'accept' | 'modify') => {
    setPairProgrammingAcceptance(variable, acceptance);
    message.success(`${variable} marked as ${acceptance === 'accept' ? 'Accepted' : 'Needs Modification'}`);
  };

  // Handle view code
  const handleViewCode = (record: any) => {
    setViewCodeModal({
      visible: true,
      variable: record.variableName,
      code: record.codeSnippet,
      rationale: record.rationale,
    });
  };

  // Table columns
  const columns = [
    {
      title: 'Variable',
      dataIndex: 'variableName',
      key: 'variableName',
      width: 150,
      fixed: 'left' as const,
      render: (name: string, record: any) => (
        <Space direction="vertical" size={2}>
          <Space size={4}>
            <Text strong={record.required}>{name}</Text>
            {record.required && <Tag color="warning">Required</Tag>}
          </Space>
        </Space>
      ),
      sorter: (a: any, b: any) => a.variableName.localeCompare(b.variableName),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 180,
      filters: [...new Set(tableData.map(d => d.category))].map(cat => ({ text: cat, value: cat })),
      onFilter: (value: any, record: any) => record.category === value,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 80,
    },
    {
      title: 'Snippet Status',
      dataIndex: 'snippetStatus',
      key: 'snippetStatus',
      width: 130,
      filters: [
        { text: 'Generated', value: 'generated' },
        { text: 'Not Generated', value: 'not_generated' },
        { text: 'Error', value: 'error' },
      ],
      onFilter: (value: any, record: any) => record.snippetStatus === value,
      render: (status: string) => {
        const config: Record<string, any> = {
          generated: { color: 'success', text: 'Generated' },
          not_generated: { color: 'default', text: 'Not Generated' },
          error: { color: 'error', text: 'Error' },
        };
        const { color, text } = config[status] || config.not_generated;
        return <Badge status={color} text={text} />;
      },
    },
    {
      title: 'Approval',
      dataIndex: 'acceptance',
      key: 'acceptance',
      width: 160,
      filters: [
        { text: 'Accepted', value: 'accept' },
        { text: 'Needs Modification', value: 'modify' },
        { text: 'Pending', value: null },
      ],
      onFilter: (value: any, record: any) => record.acceptance === value,
      render: (acceptance: 'accept' | 'modify' | null, record: any) => (
        <Radio.Group
          value={acceptance}
          onChange={(e) => handleApprovalChange(record.variableName, e.target.value)}
          size="small"
          disabled={!record.hasSnippet}
        >
          <Radio.Button value="accept">Accept</Radio.Button>
          <Radio.Button value="modify">Modify</Radio.Button>
        </Radio.Group>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size={4}>
          <Tooltip title="View code">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewCode(record)}
              disabled={!record.hasSnippet}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Empty state check
  if (approvalStats.total === 0) {
    return (
      <div className="my-validation-empty-state">
        <Card>
          <Space direction="vertical" size={16} align="center" style={{ width: '100%' }}>
            <InfoCircleOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            <Title level={3}>No Variables to Review</Title>
            <Text type="secondary">
              You haven't generated any code snippets yet. Go to Pair Programming
              to generate code for your variables.
            </Text>
            <Button type="primary">
              ← Back to Pair Programming
            </Button>
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <div className="my-validation-tab">
      {/* Header */}
      <Card className="validation-header" bordered={false}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div className="header-title">
            <CheckCircleOutlined className="header-icon" />
            <Title level={3}>My Validation</Title>
            <Text type="secondary">Pre-Generation Review & Approval Checklist</Text>
          </div>

          {/* Progress Bar */}
          <Card size="small">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text strong>Approval Progress</Text>
                <Text>{approvalStats.accepted} of {approvalStats.total} approved ({approvalStats.percentage}%)</Text>
              </div>
              <Progress
                percent={approvalStats.percentage}
                status={approvalStats.percentage >= 80 ? 'success' : 'active'}
                strokeColor={approvalStats.percentage >= 80 ? '#52c41a' : '#1890ff'}
              />
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                <Text type="success">✓ Accepted: {approvalStats.accepted}</Text>
                <Text type="warning">⚠ Needs Modification: {approvalStats.modified}</Text>
                <Text type="secondary">○ Pending: {approvalStats.pending}</Text>
              </div>
            </Space>
          </Card>

          {/* Status Alerts */}
          {approvalStats.percentage < 100 && (
            <Alert
              message={`${approvalStats.pending} variables pending approval`}
              description="You can generate consolidated code with the currently approved variables. Unapproved variables will be excluded."
              type="info"
              showIcon
              closable
            />
          )}

          {approvalStats.percentage === 100 && (
            <Alert
              message="All variables reviewed!"
              description="You're ready to generate the consolidated ADAM code."
              type="success"
              showIcon
              closable
            />
          )}
        </Space>
      </Card>

      {/* Validation Table */}
      <Card className="validation-table-card" bordered={false} style={{ marginTop: 16 }}>
        <Table
          columns={columns}
          dataSource={tableData}
          scroll={{ x: 1000, y: 600 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} variables`,
          }}
          size="small"
        />
      </Card>

      {/* View Code Modal */}
      <Modal
        title={<span><FileTextOutlined /> Code for {viewCodeModal.variable}</span>}
        open={viewCodeModal.visible}
        onCancel={() => setViewCodeModal({ visible: false })}
        footer={[
          <Button key="close" onClick={() => setViewCodeModal({ visible: false })}>
            Close
          </Button>
        ]}
        width={800}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {viewCodeModal.rationale && (
            <Alert
              message="AI Rationale"
              description={viewCodeModal.rationale}
              type="info"
              showIcon
            />
          )}
          <div>
            <Text strong>Generated Code:</Text>
            <pre style={{
              backgroundColor: '#f5f5f5',
              padding: 16,
              borderRadius: 4,
              maxHeight: 400,
              overflow: 'auto',
              marginTop: 8,
            }}>
              {viewCodeModal.code || 'No code available'}
            </pre>
          </div>
        </Space>
      </Modal>
    </div>
  );
};
