import React, { useState, useEffect } from 'react';
import { Table, Tag, DatePicker, Select, Space, Input, Button } from 'antd';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';

const { RangePicker } = DatePicker;

interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  ip_address: string;
  user_agent: string;
  changes?: any;
  checksum?: string;
}

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading] = useState(false);

  // Mock data
  useEffect(() => {
    const mockLogs: AuditLog[] = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        user_id: 'admin',
        action: 'CREATE_STUDY',
        resource_type: 'study',
        resource_id: 'STUDY-001',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0',
        checksum: 'abc123def456'
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        user_id: 'developer',
        action: 'GENERATE_CODE',
        resource_type: 'code_generation',
        resource_id: 'GEN-456',
        ip_address: '192.168.1.101',
        user_agent: 'Mozilla/5.0'
      }
    ];
    setLogs(mockLogs);
  }, []);

  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp: string) => new Date(timestamp).toLocaleString(),
      sorter: (a: AuditLog, b: AuditLog) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    },
    {
      title: 'User',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 120
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 150,
      render: (action: string) => <Tag color="blue">{action}</Tag>
    },
    {
      title: 'Resource',
      key: 'resource',
      width: 200,
      render: (_: any, record: AuditLog) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.resource_type}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.resource_id}</div>
        </div>
      )
    },
    {
      title: 'IP Address',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 140
    },
    {
      title: 'Integrity',
      dataIndex: 'checksum',
      key: 'checksum',
      width: 100,
      render: (checksum: string) => checksum ? (
        <Tag color="green">Verified</Tag>
      ) : (
        <Tag>N/A</Tag>
      )
    }
  ];

  return (
    <div className="audit-log-viewer">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Audit Trail (21 CFR Part 11 Compliant)</h3>
        <Button icon={<DownloadOutlined />}>Export Logs</Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <RangePicker />
        <Select
          placeholder="Filter by Action"
          style={{ width: 200 }}
          allowClear
        >
          <Select.Option value="CREATE_STUDY">Create Study</Select.Option>
          <Select.Option value="GENERATE_CODE">Generate Code</Select.Option>
          <Select.Option value="RUN_VALIDATION">Run Validation</Select.Option>
        </Select>
        <Input
          placeholder="Search user..."
          prefix={<SearchOutlined />}
          style={{ width: 200 }}
        />
        <Button type="primary">Apply Filters</Button>
      </Space>

      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1000 }}
      />
    </div>
  );
};
