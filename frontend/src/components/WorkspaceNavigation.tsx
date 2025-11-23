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
  RocketOutlined,
} from '@ant-design/icons';
import './WorkspaceNavigation.css';

interface WorkspaceNavigationProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onNavigate?: (path: string) => void;
}

type MainSection = 'generation' | 'validation' | 'submission';

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
      { key: '/adam-generator', label: 'ADAM Generator', icon: <RocketOutlined />, description: 'Execute R programs to generate ADAM datasets' },
      { key: '/test-with-data', label: 'SDTM Generator', icon: <ExperimentOutlined />, description: 'Generate CDISC-compliant SDTM test data' },
      { key: '/submission-dashboard', label: 'Submission Dashboard', icon: <DashboardOutlined />, description: 'Submission readiness overview' },
    ],
  },
  validation: {
    title: 'Code Validation',
    icon: <CheckCircleOutlined />,
    color: '#10b981',
    items: [
      { key: '/code-validator', label: 'Code Validator', icon: <SafetyOutlined />, description: 'Syntax and quality checks' },
    ],
  },
  submission: {
    title: 'Submission Readiness',
    icon: <FileProtectOutlined />,
    color: '#f59e0b',
    items: [],
  },
};

const TAB_TO_SECTION_MAP: Record<string, MainSection> = {
  'pair': 'generation',
  'consolidated': 'generation',
  'traceability': 'generation',
  'adam-generator': 'generation',
  'testdata': 'generation',
  'submission': 'generation',
  'validator': 'validation',
};

const PATH_TO_TAB_MAP: Record<string, string> = {
  '/pair-programming': 'pair',
  '/consolidated-code': 'consolidated',
  '/traceability': 'traceability',
  '/adam-generator': 'adam-generator',
  '/code-validator': 'validator',
  '/test-with-data': 'testdata',
  '/submission-dashboard': 'submission',
};

const TAB_TO_PATH_MAP: Record<string, string> = {
  'pair': '/pair-programming',
  'consolidated': '/consolidated-code',
  'traceability': '/traceability',
  'adam-generator': '/adam-generator',
  'validator': '/code-validator',
  'testdata': '/test-with-data',
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
    // Auto-select first item in the new section (if available)
    const firstItem = NAVIGATION_STRUCTURE[section].items[0];
    if (firstItem) {
      handleItemClick(firstItem.key);
    }
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

  return (
    <div className="workspace-navigation-single-row">
      {/* Single Row Navigation - Sections + Active Section Items in one line */}
      <div className="nav-single-row-container">
        {(Object.keys(NAVIGATION_STRUCTURE) as MainSection[]).map((section, sectionIndex) => {
          const sectionData = NAVIGATION_STRUCTURE[section];
          const isActiveSection = activeSection === section;
          
          return (
            <React.Fragment key={section}>
              {/* Section Header Button */}
              <Tooltip title={`${sectionData.title} section`} placement="bottom">
                <button
                  className={`nav-section-btn-inline ${isActiveSection ? 'active' : ''}`}
                  onClick={() => handleSectionChange(section)}
                  style={{
                    '--section-color': sectionData.color,
                  } as React.CSSProperties}
                >
                  <span className="nav-section-icon-inline">{sectionData.icon}</span>
                  <span className="nav-section-label-inline">{sectionData.title}</span>
                </button>
              </Tooltip>

              {/* Section Items - Only show items from active section, inline */}
              {isActiveSection && sectionData.items.map((item, itemIndex) => {
                const isHovered = hoveredItem === item.key;
                const isSelected = selectedPath === item.key;
                
                return (
                  <React.Fragment key={item.key}>
                    <Tooltip title={item.description} placement="bottom">
                      <button
                        className={`nav-item-pill ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleItemClick(item.key)}
                        onMouseEnter={() => setHoveredItem(item.key)}
                        onMouseLeave={() => setHoveredItem(null)}
                        style={{
                          '--item-color': sectionData.color,
                        } as React.CSSProperties}
                      >
                        <span className="nav-item-icon-pill">{item.icon}</span>
                        <span className="nav-item-label-pill">{item.label}</span>
                        {item.badge && (
                          <Badge count={item.badge} className="nav-item-badge-pill" />
                        )}
                        {isSelected && <div className="nav-item-active-dot" />}
                      </button>
                    </Tooltip>
                    
                    {/* Item divider (except for last item) */}
                    {itemIndex < sectionData.items.length - 1 && (
                      <div className="nav-item-divider" />
                    )}
                  </React.Fragment>
                );
              })}

              {/* Section divider (except for last section) */}
              {sectionIndex < Object.keys(NAVIGATION_STRUCTURE).length - 1 && (
                <div className="nav-divider" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

