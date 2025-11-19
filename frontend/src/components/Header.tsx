import { Button, Space, Dropdown, Tooltip } from 'antd';
import { SettingOutlined, BarChartOutlined, UserOutlined, HomeOutlined, LogoutOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import './Header.css';
import { useProjectStore } from '../store/projectStore';
import { showNavigationConfirmation } from './ConfirmationDialog';
import { useWorkspaceHistory } from '../store/historyStore';

interface HeaderProps {
  onBackToLanding?: () => void;
  currentUser?: any;
  onLogout?: () => void;
  onOpenHelpCenter?: () => void;
  onOpenPreferences?: () => void;
}

const Header = ({
  onBackToLanding,
  currentUser,
  onLogout,
  onOpenHelpCenter,
  onOpenPreferences
}: HeaderProps) => {
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
          resetWorkspace(); // Reset all workspace state
          clearHistory();
          onBackToLanding();
        },
        'You have unsaved work. Going back to the landing page will reset your workspace. Are you sure you want to leave?'
      );
    } else {
      // No work in progress, reset and navigate
      resetWorkspace();
      clearHistory();
      onBackToLanding();
    }
  };

  return (
    <div className="header">
      <div className="header-left">
        {onBackToLanding && (
          <Button
            className="back-button"
            icon={<HomeOutlined />}
            onClick={handleBackToLanding}
            size="middle"
          >
            Back to Landing
          </Button>
        )}
        <div className="header-title">ADAM AI Code Generator</div>
      </div>

      {/* Right controls */}
      <Space size="middle" className="header-right-controls">
        <Tooltip title="Workspace settings">
          <Button
            icon={<SettingOutlined />}
            type="text"
            className="icon-btn"
            aria-label="Workspace settings"
            onClick={onOpenPreferences}
            disabled={!onOpenPreferences}
          />
        </Tooltip>
        <Tooltip title="Validation analytics (Coming Soon)">
          <Button
            icon={<BarChartOutlined />}
            type="text"
            className="icon-btn"
            aria-label="Validation analytics"
            onClick={() => {
              // TODO: Implement validation analytics dashboard
              import('antd').then(({ message }) => {
                message.info('Validation Analytics dashboard coming soon! This feature will show comprehensive code validation statistics and trends.');
              });
            }}
          />
        </Tooltip>
        {onOpenHelpCenter && (
          <Tooltip title="Open help center (Shift + /)">
            <Button icon={<QuestionCircleOutlined />} type="text" className="icon-btn" onClick={onOpenHelpCenter}>
              Help
            </Button>
          </Tooltip>
        )}
        
        {currentUser && (
          <Dropdown
            menu={{
              items: [
                {
                  key: 'user',
                  label: (
                    <div style={{ padding: '8px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{currentUser.full_name}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{currentUser.email}</div>
                      <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                        Role: {currentUser.role}
                      </div>
                    </div>
                  ),
                  disabled: true,
                },
                {
                  type: 'divider',
                },
                {
                  key: 'logout',
                  label: 'Logout',
                  icon: <LogoutOutlined />,
                  danger: true,
                  onClick: onLogout,
                },
              ],
            }}
            trigger={['click']}
          >
            <Button icon={<UserOutlined />} type="text" className="icon-btn">
              {currentUser.username}
            </Button>
          </Dropdown>
        )}
      </Space>
    </div>
  );
};

export default Header;
