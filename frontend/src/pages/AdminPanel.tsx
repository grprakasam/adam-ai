import React, { useState } from 'react';
import { Card, Tabs } from 'antd';
import type { TabsProps } from 'antd';
import {
  UserOutlined,
  AuditOutlined,
  DashboardOutlined,
  FileTextOutlined,
  SettingOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { UserManagement } from '../components/admin/UserManagement';
import { AuditLogViewer } from '../components/admin/AuditLogViewer';
import { SystemStatistics } from '../components/admin/SystemStatistics';
import { TemplateManagement } from '../components/admin/TemplateManagement';
import { StudyManagement } from '../components/admin/StudyManagement';
import './AdminPanel.css';

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabItems: TabsProps['items'] = [
    {
      key: 'dashboard',
      label: (
        <span>
          <DashboardOutlined />
          Dashboard
        </span>
      ),
      children: <SystemStatistics />,
    },
    {
      key: 'studies',
      label: (
        <span>
          <DatabaseOutlined />
          Studies
        </span>
      ),
      children: <StudyManagement />,
    },
    {
      key: 'users',
      label: (
        <span>
          <UserOutlined />
          User Management
        </span>
      ),
      children: <UserManagement />,
    },
    {
      key: 'audit',
      label: (
        <span>
          <AuditOutlined />
          Audit Logs
        </span>
      ),
      children: <AuditLogViewer />,
    },
    {
      key: 'templates',
      label: (
        <span>
          <FileTextOutlined />
          Templates
        </span>
      ),
      children: <TemplateManagement />,
    },
  ];

  return (
    <div className="admin-panel">
      <Card
        title={
          <div className="admin-panel-header">
            <SettingOutlined style={{ marginRight: 12, fontSize: 24 }} />
            <span>Admin Panel</span>
          </div>
        }
        className="admin-panel-card"
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="card"
          size="large"
          items={tabItems}
        />
      </Card>
    </div>
  );
};
