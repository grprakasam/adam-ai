import React, { useState, useEffect } from 'react';
import { Badge, Tooltip } from 'antd';
import {
  CodeOutlined,
  TeamOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  DashboardOutlined,
  RocketOutlined,
  CommentOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import './WorkspaceNavigation.css';

interface WorkspaceNavigationProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onNavigate?: (path: string) => void;
}

type MainSection = 'adamCoding' | 'utilities';

interface NavigationItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  badge?: number;
}

const NAVIGATION_STRUCTURE: Record<MainSection, { title: string; icon: React.ReactNode; color: string; items: NavigationItem[] }> = {
  adamCoding: {
    title: 'ADAM Coding',
    icon: <CodeOutlined />,
    color: '#3b82f6',
    items: [
      { key: '/enter-study-details', label: '1. Enter Study Details', icon: <FileTextOutlined />, description: 'Enter study information and upload ADAM specification file' },
      { key: '/pair-programming', label: '2. Pair Programming', icon: <TeamOutlined />, description: 'AI-assisted variable coding' },
      { key: '/code-review', label: '3. Code Review', icon: <CommentOutlined />, description: 'Review and approve code with comments' },
      { key: '/consolidated-code', label: '4. Consolidated Code', icon: <FileTextOutlined />, description: 'Complete program generation' },
    ],
  },
  utilities: {
    title: 'AI Utilities',
    icon: <ExperimentOutlined />,
    color: '#8b5cf6',
    items: [
      { key: '/submission-dashboard', label: 'Submission', icon: <DashboardOutlined />, description: 'Regulatory submission package' },
      { key: '/adam-dataset-comparer', label: 'Dataset Comparer', icon: <FileTextOutlined />, description: 'Compare and validate ADAM datasets' },
      { key: '/code-comparer', label: 'Code Comparer', icon: <CodeOutlined />, description: 'Compare different versions of ADAM code to identify differences' },
      { key: '/adam-generator', label: 'ADAM Generator', icon: <RocketOutlined />, description: 'Execute & validate R programs' },
      { key: '/test-with-data', label: 'SDTM Test Data Generator', icon: <ExperimentOutlined />, description: 'Generate CDISC-compliant test data' },
      { key: '/r-frontend', label: 'R Frontend', icon: <ThunderboltOutlined />, description: 'Professional R code execution environment' },
      { key: '/adam-data-analytics', label: 'ADAM Data Analytics', icon: <DashboardOutlined />, description: 'Analytics and insights for ADAM data' },
      { key: '/study-chatbot', label: 'Study ChatBot', icon: <CommentOutlined />, description: 'AI-powered study assistant and Q&A' },
      { key: '/traceability', label: 'Traceability', icon: <ExperimentOutlined />, description: 'SDTM→ADAM lineage documentation' },
    ],
  },
};

const TAB_TO_SECTION_MAP: Record<string, MainSection> = {
  'study-details': 'adamCoding',
  'pair': 'adamCoding',
  'review': 'adamCoding',
  'consolidated': 'adamCoding',
  'adam-generator': 'utilities',
  'comparer': 'utilities',
  'code-comparer': 'utilities',
  'submission': 'utilities',
  'testdata': 'utilities',
  'r-frontend': 'utilities',
  'analytics': 'utilities',
  'chatbot': 'utilities',
  'traceability': 'utilities',
};

const PATH_TO_TAB_MAP: Record<string, string> = {
  '/enter-study-details': 'study-details',
  '/pair-programming': 'pair',
  '/code-review': 'review',
  '/consolidated-code': 'consolidated',
  '/adam-generator': 'adam-generator',
  '/adam-dataset-comparer': 'comparer',
  '/code-comparer': 'code-comparer',
  '/submission-dashboard': 'submission',
  '/test-with-data': 'testdata',
  '/traceability': 'traceability',
  '/r-frontend': 'r-frontend',
  '/adam-data-analytics': 'analytics',
  '/study-chatbot': 'chatbot',
};

const TAB_TO_PATH_MAP: Record<string, string> = {
  'study-details': '/enter-study-details',
  'pair': '/pair-programming',
  'review': '/code-review',
  'consolidated': '/consolidated-code',
  'adam-generator': '/adam-generator',
  'comparer': '/adam-dataset-comparer',
  'code-comparer': '/code-comparer',
  'submission': '/submission-dashboard',
  'testdata': '/test-with-data',
  'traceability': '/traceability',
  'r-frontend': '/r-frontend',
  'analytics': '/adam-data-analytics',
  'chatbot': '/study-chatbot',
};

export const WorkspaceNavigation: React.FC<WorkspaceNavigationProps> = ({
  activeTab = 'study-details',
  onTabChange,
  onNavigate
}) => {
  const [activeSection, setActiveSection] = useState<MainSection>(
    TAB_TO_SECTION_MAP[activeTab] || 'adamCoding'
  );
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>(TAB_TO_PATH_MAP[activeTab] || '/enter-study-details');

  // Debug log to verify component is rendering
  useEffect(() => {
    console.log('🎯 WorkspaceNavigation rendered - Active Section:', activeSection);
    console.log('📍 Available sections:', Object.keys(NAVIGATION_STRUCTURE));
  }, [activeSection]);

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
              <Tooltip title={`${sectionData.title} section - ${sectionData.items.length} tabs`} placement="bottom">
                <button
                  className={`nav-section-btn-inline ${isActiveSection ? 'active' : ''}`}
                  onClick={() => handleSectionChange(section)}
                  style={{
                    '--section-color': sectionData.color,
                  } as React.CSSProperties}
                >
                  <span className="nav-section-icon-inline">{sectionData.icon}</span>
                  <span className="nav-section-label-inline">{sectionData.title}</span>
                  <Badge
                    count={sectionData.items.length}
                    style={{
                      backgroundColor: isActiveSection ? 'white' : sectionData.color,
                      color: isActiveSection ? sectionData.color : 'white',
                      fontSize: '10px',
                      height: '18px',
                      lineHeight: '18px',
                      minWidth: '18px',
                      padding: '0 6px',
                      marginLeft: '4px'
                    }}
                  />
                  {!isActiveSection && (
                    <span style={{
                      fontSize: '10px',
                      marginLeft: '4px',
                      opacity: 0.7,
                      fontWeight: 400
                    }}>
                      ▼
                    </span>
                  )}
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
