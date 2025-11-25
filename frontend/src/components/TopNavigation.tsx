import React, { useState, useEffect } from 'react';
import { Dropdown } from 'antd';
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
  DownOutlined
} from '@ant-design/icons';
import { StudySelector } from './StudySelector';
import { NotificationBell } from './NotificationBell';
import { SearchButton } from './SearchButton';
import { DarkModeToggle } from './DarkModeToggle';
import { UserMenu } from './UserMenu';
import './TopNavigation.css';

interface TopNavigationProps {
  currentStudy?: any;
  onStudyChange?: (study: any) => void;
  onNavigate?: (path: string) => void;
  showLogo?: boolean;
  showUtilities?: boolean;
  showStudySelector?: boolean;
  embedded?: boolean;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({
  currentStudy,
  onStudyChange,
  onNavigate,
  showLogo = true,
  showUtilities = true,
  showStudySelector = true,
  embedded = false
}) => {
  const [, setActiveMenu] = useState<string>('');
  const [activeSection, setActiveSection] = useState<string>('');

  // Update active section based on path
  const updateActiveSection = (path: string) => {
    if (['/pair-programming', '/consolidated-code', '/traceability', '/generation-history', '/test-with-data', '/adam-generator', '/submission-dashboard', '/submission-package'].includes(path)) {
      setActiveSection('code-generation');
    } else if (['/code-validator', '/validation-reports'].includes(path)) {
      setActiveSection('code-validation');
    } else {
      setActiveSection('');
    }
  };

  // Listen for navigation events to sync active state
  useEffect(() => {
    const handleNavigationEvent = (event: CustomEvent) => {
      const path = event.detail?.path;
      if (path) {
        setActiveMenu(path);
        updateActiveSection(path);
      }
    };

    window.addEventListener('adam-ai:navigate-workspace' as any, handleNavigationEvent);
    return () => {
      window.removeEventListener('adam-ai:navigate-workspace' as any, handleNavigationEvent);
    };
  }, []);

  const handleNavigate = (path: string) => {
    setActiveMenu(path);
    updateActiveSection(path);

    // Notify workspace (RightPanel) about navigation choice
    try {
      window.dispatchEvent(
        new CustomEvent('adam-ai:navigate-workspace', {
          detail: { path },
        }),
      );
    } catch {
      // Fail silently if window or CustomEvent is not available
    }

    if (onNavigate) {
      onNavigate(path);
    }
  };

  // Code Generation Mega Menu
  const codeGenerationMenu = (
    <div className="mega-menu">
      <div className="mega-menu-header">CODE GENERATION</div>
      <div className="mega-menu-content">
        <div className="mega-menu-item" onClick={() => handleNavigate('/pair-programming')}>
          <TeamOutlined className="mega-menu-icon" />
          <div className="mega-menu-item-content">
            <div className="mega-menu-item-title">Pair Programming</div>
            <div className="mega-menu-item-desc">Generate AI code snippets with assistance</div>
          </div>
        </div>

        <div className="mega-menu-item" onClick={() => handleNavigate('/consolidated-code')}>
          <FileTextOutlined className="mega-menu-icon" />
          <div className="mega-menu-item-content">
            <div className="mega-menu-item-title">Consolidated Code</div>
            <div className="mega-menu-item-desc">View and edit complete ADAM program</div>
          </div>
        </div>

        <div className="mega-menu-item" onClick={() => handleNavigate('/traceability')}>
          <LinkOutlined className="mega-menu-icon" />
          <div className="mega-menu-item-content">
            <div className="mega-menu-item-title">Traceability</div>
            <div className="mega-menu-item-desc">SDTM-to-ADAM lineage documentation</div>
          </div>
        </div>

        <div className="mega-menu-item" onClick={() => handleNavigate('/test-with-data')}>
          <ExperimentOutlined className="mega-menu-icon" />
          <div className="mega-menu-item-content">
            <div className="mega-menu-item-title">SDTM Generator</div>
            <div className="mega-menu-item-desc">Generate CDISC-compliant SDTM test data</div>
          </div>
        </div>

        <div className="mega-menu-item" onClick={() => handleNavigate('/submission-dashboard')}>
          <DashboardOutlined className="mega-menu-icon" />
          <div className="mega-menu-item-content">
            <div className="mega-menu-item-title">Submission Dashboard</div>
            <div className="mega-menu-item-desc">Submission readiness overview and package generation</div>
          </div>
        </div>
      </div>
      <div className="mega-menu-footer">
        <a onClick={() => handleNavigate('/generation-history')}>View Generation History →</a>
      </div>
    </div>
  );

  // Code Validation Mega Menu
  const codeValidationMenu = (
    <div className="mega-menu">
      <div className="mega-menu-header">CODE VALIDATION</div>
      <div className="mega-menu-content">
        <div className="mega-menu-item" onClick={() => handleNavigate('/code-validator')}>
          <SafetyOutlined className="mega-menu-icon" />
          <div className="mega-menu-item-content">
            <div className="mega-menu-item-title">Code Validator</div>
            <div className="mega-menu-item-desc">Syntax and standards compliance checks</div>
          </div>
        </div>
      </div>
      <div className="mega-menu-footer">
        <a onClick={() => handleNavigate('/validation-reports')}>View Validation Reports →</a>
      </div>
    </div>
  );

  // Submission Readiness Mega Menu
  const submissionReadinessMenu = (
    <div className="mega-menu">
      <div className="mega-menu-header">SUBMISSION READINESS</div>
      <div className="mega-menu-content">
        <div className="mega-menu-item" onClick={() => handleNavigate('/submission-dashboard')}>
          <DashboardOutlined className="mega-menu-icon" />
          <div className="mega-menu-item-content">
            <div className="mega-menu-item-title">Submission Dashboard</div>
            <div className="mega-menu-item-desc">P21 validation, Define.xml, eCTD packaging</div>
          </div>
        </div>

      </div>
      <div className="mega-menu-footer">
        <a onClick={() => handleNavigate('/submission-package')}>Generate Submission Package →</a>
      </div>
    </div>
  );

  const containerClass = `nav-container ${showUtilities ? '' : 'nav-compact'}`;

  return (
    <div className={`top-navigation ${embedded ? 'embedded' : ''}`}>
      <div className={containerClass}>
        {/* Left Side - Logo & Main Menu */}
        <div className="nav-left">
          {showLogo && (
            <div className="nav-logo" onClick={() => handleNavigate('/')}>
              <img src="/adam-logo.svg" alt="ADAM AI" className="logo-image" />
              <span className="logo-text">ADAM AI</span>
            </div>
          )}

          <div className="nav-menu">
            <Dropdown
              overlay={codeGenerationMenu}
              trigger={['hover']}
              placement="bottomLeft"
            >
              <div className={`nav-menu-item ${activeSection === 'code-generation' ? 'active' : ''}`}>
                <CodeOutlined />
                <span>Code Generation</span>
                <DownOutlined className="nav-menu-arrow" />
              </div>
            </Dropdown>

            <Dropdown
              overlay={codeValidationMenu}
              trigger={['hover']}
              placement="bottomLeft"
            >
              <div className={`nav-menu-item ${activeSection === 'code-validation' ? 'active' : ''}`}>
                <CheckCircleOutlined />
                <span>Code Validation</span>
                <DownOutlined className="nav-menu-arrow" />
              </div>
            </Dropdown>

            <Dropdown
              overlay={submissionReadinessMenu}
              trigger={['hover']}
              placement="bottomLeft"
            >
              <div className={`nav-menu-item ${activeSection === 'submission-readiness' ? 'active' : ''}`}>
                <FileProtectOutlined />
                <span>Submission Readiness</span>
                <DownOutlined className="nav-menu-arrow" />
              </div>
            </Dropdown>
          </div>
        </div>

        {/* Right Side - Utilities */}
        {showUtilities && (
          <div className="nav-right">
            {showStudySelector && onStudyChange && (
              <StudySelector
                value={currentStudy?.id}
                onStudyChange={onStudyChange}
              />
            )}

            {showStudySelector && onStudyChange && <div className="nav-divider" />}

            <SearchButton />

            <NotificationBell />

            <DarkModeToggle />

            <div className="nav-divider" />

            <UserMenu />
          </div>
        )}
      </div>
    </div>
  );
};
