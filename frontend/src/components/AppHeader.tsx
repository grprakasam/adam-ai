import React, { useState } from 'react';
import { Button, Space, Tooltip, message, Modal, Select } from 'antd';
import {
  HomeOutlined,
  MenuOutlined,
  ApiOutlined,
  SafetyOutlined,
  ThunderboltFilled,
  SettingOutlined
} from '@ant-design/icons';
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
import { HeaderNavMenu } from './HeaderNavMenu';
import { adamApi } from '../services/api';
import './AppHeader.css';

const { Option } = Select;

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
  onNavigateToUtility?: (path: string) => void;
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
  onNavigateToUtility,
}) => {
  const { llmProvider, llmConnectionStatus, selectedModel } = useProjectStore(); // Get provider, model, and status
  const getCompletionPercentage = useProjectStore((state) => state.getCompletionPercentage);
  const resetWorkspace = useProjectStore((state) => state.resetWorkspace);
  const clearHistory = useWorkspaceHistory((state) => state.clear);
  const layoutMode = usePreferencesStore((state) => state.layoutMode);
  // Unused: const { currentStudyId: globalStudyId } = useStudyStore();

  // State for the toggle switch and modal
  const [aiMode, setAiMode] = useState<'cloud' | 'offline'>('cloud');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const handleModeChange = (mode: 'cloud' | 'offline') => {
    setAiMode(mode);
    if (mode === 'offline') {
      message.success({
        content: 'Secure Mode Active: Data is processed locally and 100% private.',
        icon: <SafetyOutlined style={{ color: '#10b981' }} />,
        duration: 3,
      });
    } else {
      message.info({
        content: 'Cloud API Active: Connected to external LLM provider.',
        icon: <ApiOutlined style={{ color: '#3b82f6' }} />,
        duration: 1,
      });
    }
  };

  const handleBackToLanding = async () => {
    if (!onBackToLanding) return;

    const completionPercentage = getCompletionPercentage();

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

  const normalizedUser = currentUser ? {
    id: currentUser.id,
    name: currentUser.full_name || currentUser.name || currentUser.username || 'User',
    email: currentUser.email,
    role: currentUser.role,
    avatar: currentUser.avatar
  } : undefined;

  const showMobileMenu =
    layoutMode === 'mobile' ||
    (layoutMode === 'auto' && window.innerWidth <= 768);

  const handleTestAIConnection = async () => {
    const hide = message.loading('Testing AI connection...', 0);
    try {
      const result = await adamApi.testLLMConnection('openai');
      hide();

      if (result && result.success) {
        message.success('AI Connection Successful: ' + (result.message || 'Connected to LLM Provider'));
      } else {
        message.error('AI Connection Failed: ' + (result?.message || 'Unknown error'));
      }
    } catch (error: any) {
      hide();
      message.error('AI Connection Error: ' + (error.message || 'Network error'));
    }
  };

  // Helper to format the display text
  const getStatusText = () => {
    if (llmConnectionStatus === 'failed') return 'Connection Failed';
    if (llmConnectionStatus === 'connected') {
      // Format provider: Capitalize first letter (e.g., 'Groq', 'OpenAI')
      let providerText = 'AI';
      if (llmProvider) {
        if (llmProvider === 'openai') providerText = 'OpenAI';
        else if (llmProvider === 'anthropic') providerText = 'Anthropic';
        else if (llmProvider === 'openrouter') providerText = 'OpenRouter';
        else providerText = llmProvider.charAt(0).toUpperCase() + llmProvider.slice(1);
      }

      // Clean up model name: Remove vendor prefix if present (e.g. 'deepseek/')
      let modelText = '';
      if (selectedModel) {
        let cleanModel = selectedModel;
        if (cleanModel.includes('/')) {
          cleanModel = cleanModel.split('/')[1]; // Take part after slash
        }
        // Further cleanup if needed (e.g. remove hashes or extra IDs)
        if (cleanModel.includes(':')) {
          cleanModel = cleanModel.split(':')[0];
        }
        modelText = ` (${cleanModel})`;
      }

      return `Connected to ${providerText} AI Service${modelText}`;
    }
    return 'Cloud Ready';
  };

  return (
    <div className="app-header">
      <div className="app-header-top">
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
            <div className="app-brand-title">Ephicacy Clinical AI Workspace</div>
          </div>

          {showStudySelector && (
            <div className="header-study-selector-wrapper">
              <span className="study-label">Study:</span>
              <StudySelector
                variant="compact"
                value={currentStudyId}
                onChange={(id) => onStudyChange && onStudyChange(id)}
                showCreateButton={true}
              />
            </div>
          )}
        </div>

        <div className="app-header-center">
          {showWorkspaceControls && (
            <div className="center-controls-wrapper app-center-panel">
              <div className="center-row-top" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="hero-toggle-container">
                  <div
                    className={`hero-toggle-option ${aiMode === 'cloud' ? 'active-cloud' : ''}`}
                    onClick={() => handleModeChange('cloud')}
                  >
                    <ApiOutlined />
                    <span>Cloud AI</span>
                  </div>
                  <div
                    className={`hero-toggle-option ${aiMode === 'offline' ? 'active-offline' : ''}`}
                    onClick={() => handleModeChange('offline')}
                  >
                    <SafetyOutlined />
                    <span>Secure Offline AI</span>
                  </div>
                </div>

                {/* Configure Button triggers Modal */}
                <Tooltip title="Configure Models & Settings">
                  <Button
                    shape="circle"
                    icon={<SettingOutlined />}
                    onClick={() => setIsConfigModalOpen(true)}
                    className="ai-config-trigger-btn"
                  />
                </Tooltip>
              </div>

              {/* Persistent Status Badge - Row 2 */}
              <div
                className={`header-status-badge ${aiMode === 'offline'
                  ? '' // Removed badge-secure to remove green bg/border
                  : llmConnectionStatus === 'connected'
                    ? ''
                    : llmConnectionStatus === 'failed'
                      ? 'badge-error'
                      : 'badge-cloud'
                  }`}
                style={(aiMode === 'offline' || (llmConnectionStatus === 'connected' && aiMode !== 'offline')) ? {
                  backgroundColor: 'transparent',
                  border: 'none',
                  padding: '6px 0',
                  color: '#8c8c8c',
                  fontSize: '11px',
                  fontWeight: 500
                } : {}}
              >
                {aiMode === 'offline' ? (
                  <>
                    <SafetyOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
                    <span className="badge-text" style={{ fontSize: '11px', color: '#8c8c8c' }}>
                      {selectedModel ? (() => {
                        let cleanName = selectedModel;
                        if (cleanName.includes('/')) cleanName = cleanName.split('/')[1];
                        if (cleanName.includes(':')) cleanName = cleanName.split(':')[0];
                        return `Secure: ${cleanName}`;
                      })() : 'Secure Vault'}
                    </span>
                    <span className="badge-dot dot-green" style={{ marginLeft: 6, boxShadow: '0 0 6px #52c41a', width: '6px', height: '6px' }}></span>
                  </>
                ) : (
                  <>
                    {llmConnectionStatus === 'connected' ? (
                      <SafetyOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
                    ) : llmConnectionStatus === 'failed' ? (
                      <ThunderboltFilled />
                    ) : (
                      <ApiOutlined />
                    )}

                    <span className="badge-text" style={llmConnectionStatus === 'connected' ? { fontSize: '11px', color: '#8c8c8c' } : {}}>
                      {getStatusText()}
                    </span>

                    <span className={`badge-dot ${llmConnectionStatus === 'connected'
                      ? 'dot-green'
                      : llmConnectionStatus === 'failed'
                        ? 'dot-red'
                        : 'dot-blue'
                      }`}
                      style={llmConnectionStatus === 'connected' ? { boxShadow: '0 0 6px #52c41a', width: '6px', height: '6px' } : {}}
                    ></span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="app-header-right">
          <Space size="middle">
            <div className="user-profile-pill">
              <span className="user-name-text">{normalizedUser?.name || 'User'}</span>
            </div>
            <div className="hide-mobile"><NotificationBell /></div>
            <LayoutSwitcher />
            <DarkModeToggle />
            <UserMenu user={normalizedUser} onLogout={onLogout} />

          </Space>
        </div>
      </div>

      {showWorkspaceControls && (
        <div className="app-header-nav-row">
          <HeaderNavMenu onNavigate={(path) => onNavigateToUtility && onNavigateToUtility(path)} />
        </div>
      )}

      {/* AI Configuration Modal */}
      <Modal
        title="Choose the AI Model"
        open={isConfigModalOpen}
        onCancel={() => setIsConfigModalOpen(false)}
        footer={null}
        width={900}
        destroyOnClose
        className="ai-config-modal"
      >
        <AIConfigStatus />
      </Modal>
    </div>
  );
};
