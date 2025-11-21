import React from 'react';
import { Button, Space } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { TopNavigation } from './TopNavigation';
import { NotificationBell } from './NotificationBell';
import { SearchButton } from './SearchButton';
import { DarkModeToggle } from './DarkModeToggle';
import { UserMenu } from './UserMenu';
import { StudySelector } from './StudySelector';
import { useProjectStore } from '../store/projectStore';
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
  onNavigate?: (path: string) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onBackToLanding,
  currentUser,
  onLogout,
  showStudySelector = false,
  currentStudyId,
  onStudyChange,
  onNavigate
}) => {
  const getCompletionPercentage = useProjectStore((state) => state.getCompletionPercentage);
  const resetWorkspace = useProjectStore((state) => state.resetWorkspace);
  const clearHistory = useWorkspaceHistory((state) => state.clear);

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
        <div className="app-header-left">
          {onBackToLanding && (
            <Button
              className="back-button"
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
            <div className="app-brand-subtitle">Workspace</div>
          </div>

          {showStudySelector && onStudyChange && (
            <div className="app-header-study">
              <StudySelector
                value={currentStudyId}
                onChange={onStudyChange}
              />
            </div>
          )}
        </div>

        <div className="app-header-right">
          <Space size="middle">
            <SearchButton />
            <NotificationBell />
            <DarkModeToggle />
            <UserMenu user={normalizedUser} onLogout={onLogout} />
          </Space>
        </div>
      </div>

      {/* Bottom row: Navigation */}
      <div className="app-header-bottom">
        <TopNavigation
          embedded
          showLogo={false}
          showUtilities={false}
          showStudySelector={false}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
};
