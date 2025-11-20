import React, { useState } from 'react';
import { Card, Tabs, Badge } from 'antd';
import {
  UserOutlined,
  AuditOutlined,
  DashboardOutlined,
  FileTextOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { UserManagement } from '../components/admin/UserManagement';
import { AuditLogViewer } from '../components/admin/AuditLogViewer';
import { SystemStatistics } from '../components/admin/SystemStatistics';
import { TemplateManagement } from '../components/admin/TemplateManagement';
import './AdminPanel.css';

const { TabPane } = Tabs;

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

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
        >
          <TabPane
            tab={
              <span>
                <DashboardOutlined />
                Dashboard
              </span>
            }
            key="dashboard"
          >
            <SystemStatistics />
          </TabPane>

          <TabPane
            tab={
              <span>
                <UserOutlined />
                User Management
              </span>
            }
            key="users"
          >
            <UserManagement />
          </TabPane>

          <TabPane
            tab={
              <span>
                <AuditOutlined />
                Audit Logs
              </span>
            }
            key="audit"
          >
            <AuditLogViewer />
          </TabPane>

          <TabPane
            tab={
              <span>
                <FileTextOutlined />
                Templates
              </span>
            }
            key="templates"
          >
            <TemplateManagement />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};
