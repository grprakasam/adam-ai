import React from 'react';
import { Dropdown, Menu, Avatar, Divider } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  BgColorsOutlined,
  LineChartOutlined,
  QuestionCircleOutlined,
  MessageOutlined,
  ReadOutlined,
  FileTextOutlined,
  ToolOutlined,
  AuditOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import './UserMenu.css';

interface UserMenuProps {
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
  };
  onLogout?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ user, onLogout }) => {
  const isAdmin = user?.role === 'admin';

  const handleMenuClick = ({ key }: { key: string }) => {
    switch (key) {
      case 'profile':
        window.location.href = '/profile';
        break;
      case 'settings':
        window.location.href = '/settings';
        break;
      case 'change-password':
        window.location.href = '/change-password';
        break;
      case 'theme':
        window.location.href = '/theme-settings';
        break;
      case 'activity':
        window.location.href = '/my-activity';
        break;
      case 'help':
        window.location.href = '/help';
        break;
      case 'feedback':
        window.location.href = '/feedback';
        break;
      case 'tutorials':
        window.location.href = '/tutorials';
        break;
      case 'release-notes':
        window.location.href = '/release-notes';
        break;
      case 'admin':
        window.location.href = '/admin';
        break;
      case 'audit-logs':
        window.location.href = '/admin/audit-logs';
        break;
      case 'logout':
        if (onLogout) {
          onLogout();
        } else {
          // Default logout behavior
          localStorage.removeItem('adam_access_token');
          localStorage.removeItem('adam_user');
          window.location.href = '/login';
        }
        break;
    }
  };

  const menu = (
    <Menu onClick={handleMenuClick} className="user-menu">
      {/* User Info */}
      <div className="user-menu-header">
        <Avatar size={48} icon={<UserOutlined />} src={user?.avatar} />
        <div className="user-menu-info">
          <div className="user-menu-name">{user?.name || 'User'}</div>
          <div className="user-menu-email">{user?.email || 'user@example.com'}</div>
          {user?.role && (
            <div className="user-menu-role">{user.role.toUpperCase()}</div>
          )}
        </div>
      </div>

      <Divider style={{ margin: '8px 0' }} />

      {/* Profile & Settings */}
      <Menu.Item key="profile" icon={<UserOutlined />}>
        Profile Settings
      </Menu.Item>
      <Menu.Item key="change-password" icon={<LockOutlined />}>
        Change Password
      </Menu.Item>
      <Menu.Item key="theme" icon={<BgColorsOutlined />}>
        Theme Settings
      </Menu.Item>
      <Menu.Item key="activity" icon={<LineChartOutlined />}>
        My Activity
      </Menu.Item>

      <Divider style={{ margin: '8px 0' }} />

      {/* Help & Support */}
      <Menu.SubMenu key="help-submenu" icon={<QuestionCircleOutlined />} title="Help & Support">
        <Menu.Item key="help" icon={<QuestionCircleOutlined />}>
          Help Center
        </Menu.Item>
        <Menu.Item key="tutorials" icon={<ReadOutlined />}>
          Tutorials
        </Menu.Item>
        <Menu.Item key="release-notes" icon={<FileTextOutlined />}>
          Release Notes
        </Menu.Item>
        <Menu.Item key="feedback" icon={<MessageOutlined />}>
          Send Feedback
        </Menu.Item>
      </Menu.SubMenu>

      {/* Admin Section (only for admins) */}
      {isAdmin && (
        <>
          <Divider style={{ margin: '8px 0' }} />
          <Menu.Item key="admin" icon={<ToolOutlined />} className="admin-menu-item">
            Admin Panel
          </Menu.Item>
          <Menu.Item key="audit-logs" icon={<AuditOutlined />} className="admin-menu-item">
            Audit Logs
          </Menu.Item>
        </>
      )}

      <Divider style={{ margin: '8px 0' }} />

      {/* Logout */}
      <Menu.Item key="logout" icon={<LogoutOutlined />} danger>
        Logout
      </Menu.Item>
    </Menu>
  );

  return (
    <Dropdown overlay={menu} trigger={['click']} placement="bottomRight">
      <div className="user-menu-trigger">
        <Avatar
          size={36}
          icon={<UserOutlined />}
          src={user?.avatar}
          style={{ cursor: 'pointer' }}
        />
      </div>
    </Dropdown>
  );
};
