import React from 'react';
import { Button, Space, Tooltip } from 'antd';
import { HomeOutlined, MenuOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { NotificationBell } from './NotificationBell';
import { DarkModeToggle } from './DarkModeToggle';
import { LayoutSwitcher } from './LayoutSwitcher';
import { UserMenu } from './UserMenu';
import { StudySelector } from './StudySelector';
import { AIConfigStatus } from './AIConfigStatus';
import { useStudyStore } from '../store/studyStore';
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
  showWorkspaceControls?: boolean;
  currentStudyId?: string;
  onStudyChange?: (studyId: string) => void;
  onToggleMobileMenu?: () => void;
  onSwitchProject?: () => void;
  onCreateStudy?: () => void;
  isOnLandingPage?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onBackToLanding,
  currentUser,
  onLogout,
  showStudySelector = false,
  showWorkspaceControls = true,
  currentStudyId,
  onStudyChange,
  onToggleMobileMenu,
  onSwitchProject,
  onCreateStudy,
  isOnLandingPage = false
}) => {
  const getCompletionPercentage = useProjectStore((state) => state.getCompletionPercentage);
  const resetWorkspace = useProjectStore((state) => state.resetWorkspace);
  const clearHistory = useWorkspaceHistory((state) => state.clear);
  const layoutMode = usePreferencesStore((state) => state.layoutMode);
  const { currentStudyId: globalStudyId } = useStudyStore();

  const displayStudyId = currentStudyId || globalStudyId || '';

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
            <div className="app-brand-title">Ephicacy Clinical AI</div>
            <div className="app-brand-subtitle hide-mobile">Workspace</div>
          </div>

          {/* AI Configuration Status - in left section */}
          {showWorkspaceControls && <AIConfigStatus className="hide-mobile" />}
        </div>

        {/* Center: Study Badge (Interactive) */}
        <div className="app-header-center">
          {showStudySelector && (
            <StudySelector
              value={currentStudyId}
              onChange={onStudyChange}
              showCreateButton={false}
              variant="hero"
            />
          )}
        </div>

        <div className="app-header-right">
          <Space size="middle">
            <div className="hide-mobile app-header-identity">
              <div className="identity-line">
                User: {normalizedUser?.name || '—'}
              </div>
            </div>
            <div className="hide-mobile"><NotificationBell /></div>
            <LayoutSwitcher />
            <DarkModeToggle />
            <UserMenu user={normalizedUser} onLogout={onLogout} />
          </Space>
        </div>
      </div>
    </div >
  );
};

