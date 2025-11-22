import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Progress, Spin, Alert } from 'antd';
import {
  UserOutlined,
  ProjectOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';

interface SystemStats {
  total_users: number;
  active_users_today: number;
  total_studies: number;
  total_generations: number;
  total_validations: number;
  average_generation_time: number;
  success_rate: number;
  recent_activity: Array<{
    timestamp: string;
    user: string;
    action: string;
    details: string;
  }>;
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
      // Mock data for now - replace with actual API call
      const mockStats: SystemStats = {
        total_users: 25,
        active_users_today: 8,
        total_studies: 42,
        total_generations: 1253,
        total_validations: 387,
        average_generation_time: 4.2,
        success_rate: 94.5,
        recent_activity: [
          {
            timestamp: new Date().toISOString(),
            user: 'admin',
            action: 'Generated ADSL code',
            details: 'Study: STUDY-001'
          },
          {
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            user: 'developer',
            action: 'Ran P21 validation',
            details: 'Dataset: ADAE'
          }
        ]
      };
      setStats(mockStats);
    } catch (error) {
      console.error('Failed to load statistics:', error);
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
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp: string) => new Date(timestamp).toLocaleString()
    },
    {
      title: 'User',
      dataIndex: 'user',
      key: 'user',
      width: 120
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 200
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details'
    }
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
              value={stats.total_users}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 8 }}>
              {stats.active_users_today} active today
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Studies"
              value={stats.total_studies}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Code Generations"
              value={stats.total_generations}
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
          <Card title="Success Rate">
            <Progress
              type="circle"
              percent={stats.success_rate}
              format={percent => `${percent}%`}
              strokeColor="#52c41a"
              width={120}
            />
            <div style={{ marginTop: 16, fontSize: 14, color: '#8c8c8c' }}>
              Generation success rate
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Average Generation Time">
            <div style={{ textAlign: 'center', padding: 20 }}>
              <ClockCircleOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
              <div style={{ fontSize: 36, fontWeight: 600 }}>
                {stats.average_generation_time}s
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: '#8c8c8c' }}>
                Per code generation request
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Recent Activity */}
      <Card title="Recent Activity" style={{ marginBottom: 16 }}>
        <Table
          columns={activityColumns}
          dataSource={stats.recent_activity}
          rowKey={(record, index) => `${record.timestamp}-${index}`}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};
