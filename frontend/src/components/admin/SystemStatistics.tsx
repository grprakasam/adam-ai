import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Progress, Spin, Alert, message } from 'antd';
import {
  UserOutlined,
  ProjectOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';

interface SystemStats {
  users_count: number;
  studies_count: number;
  active_sessions: number;
  recent_activity_24h: number;
  timestamp: string;
}

export const SystemStatistics: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const response = await axios.get<SystemStats>(`${baseUrl}/api/v1/admin/stats`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adam_access_token') || ''}`,
        },
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load statistics:', error);
      message.error('Failed to load system statistics');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!stats) {
    return <Alert type="error" message="Failed to load system statistics" />;
  }

  const activityColumns = [
    {
      title: 'Metric',
      dataIndex: 'metric',
      key: 'metric',
      width: 200,
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
    }
  ];

  const activityData = [
    {
      metric: 'Active Sessions',
      value: stats.active_sessions,
    },
    {
      metric: 'Audit Events (last 24h)',
      value: stats.recent_activity_24h,
    },
    {
      metric: 'Snapshot Time',
      value: new Date(stats.timestamp).toLocaleString(),
    },
  ];

  return (
    <div className="system-statistics">
      <h3 style={{ marginBottom: 24 }}>System Overview</h3>

      {/* Key Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={stats.users_count}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Studies"
              value={stats.studies_count}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active Sessions"
              value={stats.active_sessions}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Validations Run"
              value={stats.total_validations}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Performance Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} lg={12}>
          <Card title="Recent Audit Activity (24h)">
            <div style={{ textAlign: 'center', padding: 20 }}>
              <Progress
                type="circle"
                percent={Math.min(100, stats.recent_activity_24h || 0)}
                format={() => `${stats.recent_activity_24h}`}
                strokeColor="#52c41a"
                width={120}
              />
              <div style={{ marginTop: 16, fontSize: 14, color: '#8c8c8c' }}>
                Number of audit trail events recorded in the last 24 hours
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Snapshot Time">
            <div style={{ textAlign: 'center', padding: 20 }}>
              <ClockCircleOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
              <div style={{ fontSize: 36, fontWeight: 600 }}>
                {new Date(stats.timestamp).toLocaleTimeString()}
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: '#8c8c8c' }}>
                {new Date(stats.timestamp).toLocaleDateString()}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Recent Activity */}
      <Card title="System Metrics Snapshot" style={{ marginBottom: 16 }}>
        <Table
          columns={activityColumns}
          dataSource={activityData}
          rowKey={(record) => record.metric}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};
