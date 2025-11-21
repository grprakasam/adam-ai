import React, { useEffect } from 'react';
import { Tooltip, Dropdown } from 'antd';
import { MobileOutlined, DesktopOutlined, SyncOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { usePreferencesStore } from '../store/preferencesStore';
import './LayoutSwitcher.css';

export const LayoutSwitcher: React.FC = () => {
  const { layoutMode, setLayoutMode } = usePreferencesStore();

  useEffect(() => {
    // Apply layout mode class to body
    document.body.setAttribute('data-layout-mode', layoutMode);
  }, [layoutMode]);

  const getIcon = () => {
    switch (layoutMode) {
      case 'mobile':
        return <MobileOutlined className="layout-icon" />;
      case 'desktop':
        return <DesktopOutlined className="layout-icon" />;
      default:
        return <SyncOutlined className="layout-icon" />;
    }
  };

  const getTitle = () => {
    switch (layoutMode) {
      case 'mobile':
        return 'Mobile Layout (Force mobile view)';
      case 'desktop':
        return 'Desktop Layout (Force desktop view)';
      default:
        return 'Auto Layout (Responsive based on screen size)';
    }
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'auto',
      icon: <SyncOutlined />,
      label: 'Auto (Responsive)',
      onClick: () => setLayoutMode('auto'),
    },
    {
      key: 'mobile',
      icon: <MobileOutlined />,
      label: 'Mobile Layout',
      onClick: () => setLayoutMode('mobile'),
    },
    {
      key: 'desktop',
      icon: <DesktopOutlined />,
      label: 'Desktop Layout',
      onClick: () => setLayoutMode('desktop'),
    },
  ];

  return (
    <Tooltip title={getTitle()}>
      <Dropdown 
        menu={{ items: menuItems, selectedKeys: [layoutMode] }}
        trigger={['click']}
        placement="bottomRight"
      >
        <button 
          className={`layout-switcher-button ${layoutMode}`}
          aria-label="Switch layout mode"
        >
          {getIcon()}
        </button>
      </Dropdown>
    </Tooltip>
  );
};

