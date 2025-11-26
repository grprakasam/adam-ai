import React from 'react';
import { Button, Space } from 'antd';
import { HomeOutlined, MenuOutlined } from '@ant-design/icons';
import { NotificationBell } from './NotificationBell';
import { SearchButton } from './SearchButton';
import { DarkModeToggle } from './DarkModeToggle';
import { LayoutSwitcher } from './LayoutSwitcher';
import { UserMenu } from './UserMenu';
import { StudySelector } from './StudySelector';
import { AIConfigStatus } from './AIConfigStatus';
import { useProjectStore } from '../store/projectStore';
import { usePreferencesStore } from '../store/preferencesStore';
import { showNavigationConfirmation } from './ConfirmationDialog';
import { useWorkspaceHistory } from '../store/historyStore';
import './AppHeader.css';

interface AppHeaderProps {
  onBackToLanding?: () => void;
  currentUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
    username?: string;
    full_name?: string;
    avatar?: string;
  };
  onLogout?: () => void;
  showStudySelector?: boolean;
  currentStudyId?: string;
  onStudyChange?: (studyId: string) => void;
  onToggleMobileMenu?: () => void;
  onSwitchProject?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onBackToLanding,
  currentUser,
  onLogout,
  showStudySelector = false,
  currentStudyId,
  onStudyChange,
  onToggleMobileMenu,
  onSwitchProject
}) => {
  const getCompletionPercentage = useProjectStore((state) => state.getCompletionPercentage);
  const resetWorkspace = useProjectStore((state) => state.resetWorkspace);
  const clearHistory = useWorkspaceHistory((state) => state.clear);
  const layoutMode = usePreferencesStore((state) => state.layoutMode);

  // Determine if we should show mobile menu button
  const showMobileMenu = 
    layoutMode === 'mobile' || 
    (layoutMode === 'auto' && window.innerWidth <= 768);

  const handleBackToLanding = async () => {
    if (!onBackToLanding) return;

    const completionPercentage = getCompletionPercentage();

    // If user has made progress, show confirmation
    if (completionPercentage > 0) {
      await showNavigationConfirmation(
        () => {
          resetWorkspace();
          clearHistory();
          onBackToLanding();
        },
        'You have unsaved work. Going back to the landing page will reset your workspace. Are you sure you want to leave?'
      );
    } else {
      resetWorkspace();
      clearHistory();
      onBackToLanding();
    }
  };

  // Normalize user data for UserMenu
  const normalizedUser = currentUser ? {
    id: currentUser.id,
    name: currentUser.full_name || currentUser.name || currentUser.username || 'User',
    email: currentUser.email,
    role: currentUser.role,
    avatar: currentUser.avatar
  } : undefined;

  return (
    <div className="app-header">
      {/* Top row: Branding, Study Selector, Utilities */}
      <div className="app-header-top">
        {/* Mobile Menu Button */}
        {onToggleMobileMenu && showMobileMenu && (
          <Button
            className="mobile-menu-btn"
            icon={<MenuOutlined />}
            onClick={onToggleMobileMenu}
            size="large"
            type="text"
            aria-label="Toggle menu"
          />
        )}

        <div className="app-header-left">
          {onBackToLanding && (
            <Button
              className="back-button hide-mobile"
              icon={<HomeOutlined />}
              onClick={handleBackToLanding}
              size="middle"
              type="text"
            >
              Home
            </Button>
          )}
          <div className="app-brand">
            <div className="app-brand-title">ADAM AI</div>
            <div className="app-brand-subtitle hide-mobile">Workspace</div>
          </div>

          {showStudySelector && onStudyChange && (
            <div className="app-header-study hide-mobile">
              <StudySelector
                value={currentStudyId}
                onChange={onStudyChange}
              />
            </div>
          )}

          {/* AI Configuration Status - in left section */}
          <AIConfigStatus className="hide-mobile" />
        </div>

        <div className="app-header-right">
          <Space size="middle">
            <Button
              icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="18" rx="1" />
                <rect x="14" y="3" width="7" height="18" rx="1" />
              </svg>}
              onClick={() => {
                const event = new CustomEvent('adam-ai:toggle-left-panel');
                window.dispatchEvent(event);
              }}
              size="small"
              title="Toggle Configuration Panel"
              className="toggle-panel-btn hide-mobile"
              style={{
                height: '26px',
                fontSize: '11px',
                padding: '0 8px',
                borderRadius: '5px',
                lineHeight: '1.2'
              }}
            >
              Toggle Panel
            </Button>
            <div className="hide-mobile"><SearchButton /></div>
            <div className="hide-mobile"><NotificationBell /></div>
            <LayoutSwitcher />
            <DarkModeToggle />
            <UserMenu user={normalizedUser} onLogout={onLogout} />
          </Space>
        </div>
      </div>
    </div>
  );
};
