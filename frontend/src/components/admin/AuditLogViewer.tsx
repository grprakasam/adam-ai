import React, { useState, useEffect } from 'react';
import { Table, Tag, DatePicker, Select, Space, Input, Button, message } from 'antd';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';

const { RangePicker } = DatePicker;

interface AuditLog {
  id: number;
  timestamp: string;
  user_id: string;
  user_name?: string;
  action: string;
  resource_type: string;
  resource_id: string;
  ip_address: string;
  user_agent: string;
  study_id?: string;
  details?: any;
  session_id?: string;
}

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);
  const [userSearch, setUserSearch] = useState<string>('');
  const [dateRange, setDateRange] = useState<[string | null, string | null] | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const params: any = {
        skip: 0,
        limit: 200,
      };

      if (actionFilter) {
        params.action = actionFilter;
      }
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.start_date = dateRange[0];
        params.end_date = dateRange[1];
      }

      const response = await axios.get<AuditLog[]>(`${baseUrl}/api/v1/admin/audit-logs`, {
        params,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adam_access_token') || ''}`,
        },
      });

      let data = response.data || [];
      if (userSearch.trim()) {
        const searchLower = userSearch.trim().toLowerCase();
        data = data.filter((log) =>
          log.user_id.toLowerCase().includes(searchLower) ||
          (log.user_name && log.user_name.toLowerCase().includes(searchLower))
        );
      }

      setLogs(data);
    } catch (error) {
      console.error('Failed to load audit logs', error);
      message.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      key: 'user',
      width: 180,
      render: (record: AuditLog) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.user_name || record.user_id}</div>
          {record.user_id && (
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.user_id}</div>
          )}
        </div>
      )
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
      title: 'Study',
      dataIndex: 'study_id',
      key: 'study_id',
      width: 140,
      render: (study_id: string | undefined) => study_id || '—',
    },
    {
      title: 'IP Address',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 140
    },
  ];

  return (
    <div className="audit-log-viewer">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Audit Trail (21 CFR Part 11 Compliant)</h3>
        <Button
          icon={<DownloadOutlined />}
          onClick={async () => {
            try {
              const baseUrl = import.meta.env.VITE_API_URL || '';
              const response = await axios.get(`${baseUrl}/api/v1/admin/audit-logs/export`, {
                params: { format: 'csv' },
                headers: {
                  Authorization: `Bearer ${localStorage.getItem('adam_access_token') || ''}`,
                },
                responseType: 'blob',
              });

              const blob = new Blob([response.data], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `audit_logs_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              window.URL.revokeObjectURL(url);
            } catch (error) {
              console.error('Failed to export audit logs', error);
              message.error('Failed to export audit logs');
            }
          }}
        >
          Export Logs
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <RangePicker
          onChange={(values) => {
            if (!values || values.length !== 2) {
              setDateRange(null);
            } else {
              setDateRange([values[0]?.toISOString() ?? null, values[1]?.toISOString() ?? null]);
            }
          }}
        />
        <Select
          placeholder="Filter by Action"
          style={{ width: 200 }}
          allowClear
          onChange={(value) => setActionFilter(value)}
        >
          <Select.Option value="STUDY_CREATED">Study Created</Select.Option>
          <Select.Option value="CODE_GENERATION_COMPLETED">Code Generated</Select.Option>
          <Select.Option value="P21_VALIDATION_RUN">P21 Validation</Select.Option>
        </Select>
        <Input
          placeholder="Search user..."
          prefix={<SearchOutlined />}
          style={{ width: 200 }}
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
        />
        <Button type="primary" onClick={loadLogs}>
          Apply Filters
        </Button>
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
