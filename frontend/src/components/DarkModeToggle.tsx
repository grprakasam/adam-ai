import React, { useState, useEffect } from 'react';
import { Switch, Tooltip } from 'antd';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import './DarkModeToggle.css';

export const DarkModeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage or system preference
    const saved = localStorage.getItem('adam-theme');
    if (saved) {
      return saved === 'dark';
    }
    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Apply theme
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

    // Save preference
    localStorage.setItem('adam-theme', isDark ? 'dark' : 'light');

    // Update Ant Design theme (if using ConfigProvider)
    const event = new CustomEvent('theme-change', { detail: { isDark } });
    window.dispatchEvent(event);
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
      <div className="dark-mode-toggle">
        <Switch
          checked={isDark}
          onChange={toggleTheme}
          checkedChildren={<MoonOutlined />}
          unCheckedChildren={<SunOutlined />}
        />
      </div>
    </Tooltip>
  );
};
