import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, Dropdown, List, Button, Empty, Tag, Spin } from 'antd';
import {
  BellOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { api } from '../services/api';
import './NotificationBell.css';

interface Notification {
  id: number;
  type: 'success' | 'warning' | 'error' | 'info' | 'task';
  title: string;
  description?: string;
  link?: string;
  read: boolean;
  created_at: string;
  study_id?: string;
}

export const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadInitialData();
    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadNotifications(),
        loadUnreadCount()
      ]);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const response = await api.get('/api/v1/notifications?limit=20');
      setNotifications(response.data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await api.get('/api/v1/notifications/unread-count');
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const connectWebSocket = () => {
    const token = localStorage.getItem('adam_access_token');
    if (!token) {
      console.warn('No auth token found, skipping WebSocket connection');
      return;
    }

    try {
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/v1/notifications/ws?token=${token}`;
      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        console.log('WebSocket connected');
        wsRef.current = websocket;
      };

      websocket.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data);
          handleNewNotification(notification);
        } catch (error) {
          console.error('Error parsing notification:', error);
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      websocket.onclose = () => {
        console.log('WebSocket disconnected');
        wsRef.current = null;

        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...');
          connectWebSocket();
        }, 5000);
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const handleNewNotification = (notification: Notification) => {
    // Add to list
    setNotifications(prev => [notification, ...prev]);

    // Increment unread count if not read
    if (!notification.read) {
      setUnreadCount(prev => prev + 1);
    }

    // Show browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('ADAM AI', {
        body: notification.title,
        icon: '/adam-logo.svg',
        badge: '/adam-logo.svg'
      });
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await api.put(`/api/v1/notifications/${id}/read`);

      // Update local state
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/api/v1/notifications/read-all');

      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Navigate if link provided
    if (notification.link) {
      window.location.href = notification.link;
      setDropdownVisible(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'warning':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'task':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      default:
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
    }
  };

  const getNotificationTag = (type: string) => {
    const colors: Record<string, string> = {
      success: 'success',
      warning: 'warning',
      error: 'error',
      info: 'processing',
      task: 'default'
    };
    return <Tag color={colors[type] || 'default'}>{type.toUpperCase()}</Tag>;
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const notificationMenu = (
    <div className="notification-dropdown">
      <div className="notification-header">
        <span className="notification-title">Notifications</span>
        {unreadCount > 0 && (
          <Button type="link" size="small" onClick={markAllAsRead}>
            Mark all read
          </Button>
        )}
      </div>

      <div className="notification-list">
        {loading ? (
          <div className="notification-loading">
            <Spin />
          </div>
        ) : notifications.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No notifications"
            style={{ padding: '40px 20px' }}
          />
        ) : (
          <List
            dataSource={notifications}
            renderItem={(item) => (
              <div
                className={`notification-item ${item.read ? 'read' : 'unread'}`}
                onClick={() => handleNotificationClick(item)}
              >
                <div className="notification-item-icon">
                  {getNotificationIcon(item.type)}
                </div>
                <div className="notification-item-content">
                  <div className="notification-item-header">
                    <span className="notification-item-title">{item.title}</span>
                    {getNotificationTag(item.type)}
                  </div>
                  {item.description && (
                    <div className="notification-item-desc">{item.description}</div>
                  )}
                  <div className="notification-item-time">{getTimeAgo(item.created_at)}</div>
                </div>
              </div>
            )}
          />
        )}
      </div>

      <div className="notification-footer">
        <Button type="link" block onClick={() => {
          window.location.href = '/notifications';
          setDropdownVisible(false);
        }}>
          View All Notifications
        </Button>
      </div>
    </div>
  );

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <Dropdown
      overlay={notificationMenu}
      trigger={['click']}
      placement="bottomRight"
      open={dropdownVisible}
      onOpenChange={setDropdownVisible}
    >
      <div className="notification-bell">
        <Badge count={unreadCount} offset={[-5, 5]} overflowCount={99}>
          <BellOutlined className="notification-bell-icon" />
        </Badge>
      </div>
    </Dropdown>
  );
};
