import React from 'react';
import {
  FolderKanban,
  Database,
  FileCode,
  Play,
  LayoutGrid,
  FileText
} from 'lucide-react';
import './TabNavigation.css';

export interface Tab {
  key: string;
  label: string;
  icon?: React.ReactNode;
  status?: 'complete' | 'incomplete' | 'warning' | 'not-started';
  count?: number;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabKey: string) => void;
}

const statusConfig = {
  complete: { label: 'OK', color: 'success' },
  incomplete: { label: '!', color: 'warning' },
  warning: { label: 'WARN', color: 'warning' },
  'not-started': { label: '-', color: 'neutral' },
};

const defaultIcons: Record<string, React.ReactNode> = {
  project: <FolderKanban size={20} />,
  dataset: <LayoutGrid size={20} />,
  specification: <FileText size={20} />,
  standards: <Database size={20} />,
  rules: <FileCode size={20} />,
  generate: <Play size={20} />,
};

export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onTabChange,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent, tabKey: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTabChange(tabKey);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const currentIndex = tabs.findIndex((t) => t.key === activeTab);
      const nextIndex = (currentIndex + 1) % tabs.length;
      onTabChange(tabs[nextIndex].key);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIndex = tabs.findIndex((t) => t.key === activeTab);
      const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
      onTabChange(tabs[prevIndex].key);
    }
  };

  return (
    <nav className="tab-navigation" role="tablist" aria-label="Workspace sections">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        const icon = tab.icon || defaultIcons[tab.key];
        const statusInfo = tab.status ? statusConfig[tab.status] : null;

        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.key}`}
            tabIndex={isActive ? 0 : -1}
            className={`tab-item ${isActive ? 'tab-item-active' : ''}`}
            onClick={() => onTabChange(tab.key)}
            onKeyDown={(e) => handleKeyDown(e, tab.key)}
          >
            <div className="tab-icon">{icon}</div>
            <div className="tab-content">
              <div className="tab-label">{tab.label}</div>
              <div className="tab-meta">
                {statusInfo && (
                  <span className={`badge badge-${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                )}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="badge badge-neutral">{tab.count}</span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </nav>
  );
};
