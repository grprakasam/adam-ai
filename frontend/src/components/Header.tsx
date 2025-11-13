import { Button, Space } from 'antd';
import { SettingOutlined, BarChartOutlined, UserOutlined, HomeOutlined } from '@ant-design/icons';
import './Header.css';
import { useProjectStore } from '../store/projectStore';
import { showNavigationConfirmation } from './ConfirmationDialog';

interface HeaderProps {
  onBackToLanding?: () => void;
}

const Header = ({
  onBackToLanding
}: HeaderProps) => {
  const getCompletionPercentage = useProjectStore((state) => state.getCompletionPercentage);
  const resetWorkspace = useProjectStore((state) => state.resetWorkspace);

  const handleBackToLanding = async () => {
    if (!onBackToLanding) return;

    const completionPercentage = getCompletionPercentage();

    // If user has made progress, show confirmation
    if (completionPercentage > 0) {
      await showNavigationConfirmation(
        () => {
          resetWorkspace(); // Reset all workspace state
          onBackToLanding();
        },
        'You have unsaved work. Going back to the landing page will reset your workspace. Are you sure you want to leave?'
      );
    } else {
      // No work in progress, reset and navigate
      resetWorkspace();
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
        <Button icon={<SettingOutlined />} type="text" className="icon-btn" />
        <Button icon={<BarChartOutlined />} type="text" className="icon-btn" />
        <Button icon={<UserOutlined />} type="text" className="icon-btn" />
      </Space>
    </div>
  );
};

export default Header;
