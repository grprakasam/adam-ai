import React, { useState, useEffect } from 'react';
import { Badge, Tooltip } from 'antd';
import {
  CodeOutlined,
  CheckCircleOutlined,
  FileProtectOutlined,
  TeamOutlined,
  FileTextOutlined,
  LinkOutlined,
  SafetyOutlined,
  ExperimentOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import './WorkspaceNavigation.css';

interface WorkspaceNavigationProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onNavigate?: (path: string) => void;
}

type MainSection = 'generation' | 'validation' | 'submission';
type SubSection = string;

interface NavigationItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  badge?: number;
}

const NAVIGATION_STRUCTURE: Record<MainSection, { title: string; icon: React.ReactNode; color: string; items: NavigationItem[] }> = {
  generation: {
    title: 'Code Generation',
    icon: <CodeOutlined />,
    color: '#3b82f6',
    items: [
      { key: '/pair-programming', label: 'Pair Programming', icon: <TeamOutlined />, description: 'AI-assisted variable coding' },
      { key: '/consolidated-code', label: 'Consolidated Code', icon: <FileTextOutlined />, description: 'Complete program generation' },
      { key: '/traceability', label: 'Traceability', icon: <LinkOutlined />, description: 'SDTM to ADAM mapping' },
    ],
  },
  validation: {
    title: 'Code Validation',
    icon: <CheckCircleOutlined />,
    color: '#10b981',
    items: [
      { key: '/code-validator', label: 'Code Validator', icon: <SafetyOutlined />, description: 'Syntax and quality checks' },
      { key: '/test-with-data', label: 'Test with Data', icon: <ExperimentOutlined />, description: 'Execute with test datasets' },
      { key: '/my-validation', label: 'My Validation', icon: <CheckCircleOutlined />, description: 'Custom validation rules' },
    ],
  },
  submission: {
    title: 'Submission Readiness',
    icon: <FileProtectOutlined />,
    color: '#f59e0b',
    items: [
      { key: '/submission-dashboard', label: 'Submission Dashboard', icon: <DashboardOutlined />, description: 'Submission readiness overview' },
    ],
  },
};

const TAB_TO_SECTION_MAP: Record<string, MainSection> = {
  'pair': 'generation',
  'consolidated': 'generation',
  'traceability': 'generation',
  'validator': 'validation',
  'testdata': 'validation',
  'validation': 'validation',
  'submission': 'submission',
};

const PATH_TO_TAB_MAP: Record<string, string> = {
  '/pair-programming': 'pair',
  '/consolidated-code': 'consolidated',
  '/traceability': 'traceability',
  '/code-validator': 'validator',
  '/test-with-data': 'testdata',
  '/my-validation': 'validation',
  '/submission-dashboard': 'submission',
};

const TAB_TO_PATH_MAP: Record<string, string> = {
  'pair': '/pair-programming',
  'consolidated': '/consolidated-code',
  'traceability': '/traceability',
  'validator': '/code-validator',
  'testdata': '/test-with-data',
  'validation': '/my-validation',
  'submission': '/submission-dashboard',
};

export const WorkspaceNavigation: React.FC<WorkspaceNavigationProps> = ({ 
  activeTab = 'pair',
  onTabChange,
  onNavigate 
}) => {
  const [activeSection, setActiveSection] = useState<MainSection>(
    TAB_TO_SECTION_MAP[activeTab] || 'generation'
  );
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>(TAB_TO_PATH_MAP[activeTab] || '/pair-programming');

  // Update section when active tab changes
  useEffect(() => {
    const section = TAB_TO_SECTION_MAP[activeTab];
    if (section) {
      setActiveSection(section);
      const path = TAB_TO_PATH_MAP[activeTab];
      if (path) {
        setSelectedPath(path);
      }
    }
  }, [activeTab]);

  const handleSectionChange = (section: MainSection) => {
    setActiveSection(section);
    // Auto-select first item in the new section
    const firstItem = NAVIGATION_STRUCTURE[section].items[0];
    handleItemClick(firstItem.key);
  };

  const handleItemClick = (path: string) => {
    setSelectedPath(path);
    
    // Find the tab key for this path
    const tabKey = PATH_TO_TAB_MAP[path];
    if (tabKey && onTabChange) {
      onTabChange(tabKey);
    }
    
    if (onNavigate) {
      onNavigate(path);
    }
    
    // Dispatch custom event for workspace navigation
    window.dispatchEvent(
      new CustomEvent('adam-ai:navigate-workspace', {
        detail: { path },
      })
    );
  };

  const currentSection = NAVIGATION_STRUCTURE[activeSection];

  return (
    <div className="workspace-navigation">
      {/* Main Section Selector - Segmented Control Style */}
      <div className="nav-main-sections">
        {(Object.keys(NAVIGATION_STRUCTURE) as MainSection[]).map((section) => {
          const sectionData = NAVIGATION_STRUCTURE[section];
          const isActive = activeSection === section;
          
          return (
            <button
              key={section}
              className={`nav-section-btn ${isActive ? 'active' : ''}`}
              onClick={() => handleSectionChange(section)}
              style={{
                '--section-color': sectionData.color,
              } as React.CSSProperties}
            >
              <span className="nav-section-icon">{sectionData.icon}</span>
              <span className="nav-section-label">{sectionData.title}</span>
              {isActive && <div className="nav-section-indicator" />}
            </button>
          );
        })}
      </div>

      {/* Sub-navigation - Card-based Grid */}
      <div className="nav-sub-sections">
        {currentSection.items.map((item) => {
          const isHovered = hoveredItem === item.key;
          const isSelected = selectedPath === item.key;
          
          return (
            <Tooltip key={item.key} title={item.description} placement="bottom">
              <button
                className={`nav-item-card ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => handleItemClick(item.key)}
                onMouseEnter={() => setHoveredItem(item.key)}
                onMouseLeave={() => setHoveredItem(null)}
                style={{
                  '--item-color': currentSection.color,
                } as React.CSSProperties}
              >
                <div className="nav-item-icon">{item.icon}</div>
                <div className="nav-item-content">
                  <div className="nav-item-label">{item.label}</div>
                  <div className="nav-item-description">{item.description}</div>
                </div>
                {item.badge && (
                  <Badge count={item.badge} className="nav-item-badge" />
                )}
                {isSelected && <div className="nav-item-selected-indicator" />}
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

