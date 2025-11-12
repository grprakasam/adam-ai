import { Select, Button, Space, Tag } from 'antd';
import { SettingOutlined, BarChartOutlined, UserOutlined, HomeOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ProgrammingLanguage, LLMProvider } from '../types';
import './Header.css';
import { useProjectStore } from '../store/projectStore';
import { showNavigationConfirmation } from './ConfirmationDialog';

interface HeaderProps {
  language: ProgrammingLanguage;
  llmProvider: LLMProvider;
  onLanguageChange: (language: ProgrammingLanguage) => void;
  onLlmProviderChange: (provider: LLMProvider) => void;
  onBackToLanding?: () => void;
}

const Header = ({
  language,
  llmProvider,
  onLanguageChange,
  onLlmProviderChange,
  onBackToLanding
}: HeaderProps) => {
  const getCompletionPercentage = useProjectStore((state) => state.getCompletionPercentage);
  const resetWorkspace = useProjectStore((state) => state.resetWorkspace);

  // Provider information mapping
  const providerInfo: Record<LLMProvider, { name: string; model: string; description: string; color: string }> = {
    'groq': { 
      name: 'Groq', 
      model: 'llama-3.3-70b-versatile',
      description: '🚀 Ultra-fast inference (280 tokens/sec) • 14,400 free requests/day',
      color: 'green'
    },
    'openai': { 
      name: 'OpenAI', 
      model: 'gpt-4',
      description: '🧠 Most capable model • Best for complex reasoning',
      color: 'blue'
    },
    'anthropic': { 
      name: 'Anthropic', 
      model: 'claude-3.5-sonnet',
      description: '✨ Balanced performance • Excellent code quality',
      color: 'purple'
    },
    'google': { 
      name: 'Google', 
      model: 'gemini-pro',
      description: '🌐 Multimodal capabilities • Good for varied tasks',
      color: 'orange'
    }
  };

  const currentProvider = providerInfo[llmProvider];

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

  const handleRefresh = async () => {
    const completionPercentage = getCompletionPercentage();

    // If user has made progress, show confirmation
    if (completionPercentage > 0) {
      await showNavigationConfirmation(
        () => {
          resetWorkspace(); // Reset all workspace state
          // Reload the page to ensure complete refresh
          window.location.reload();
        },
        'This will reset all your work and start fresh. All uploaded files, configurations, and generated code will be lost. Are you sure you want to continue?'
      );
    } else {
      // No work in progress, just reset and reload
      resetWorkspace();
      window.location.reload();
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
      
      <Space size="middle" className="header-controls">
        <div className="llm-indicator">
          <Tag color={currentProvider.color}>{currentProvider.name}</Tag>
          <Tag>{currentProvider.model}</Tag>
        </div>
        
        <Button 
          icon={<ReloadOutlined />} 
          onClick={handleRefresh}
          danger
          type="default"
          size="middle"
          className="refresh-button"
        >
          Refresh
        </Button>
        
        <Select
          value={llmProvider}
          onChange={onLlmProviderChange}
          className="provider-selector"
          placeholder="Select LLM Provider"
          style={{ minWidth: 280 }}
        >
          <Select.Option value="groq">
            <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
              <strong>🚀 Groq (llama-3.3-70b)</strong>
              <small style={{ color: '#52c41a' }}>Fast & Free • 280 tokens/sec • 14.4k requests/day</small>
            </div>
          </Select.Option>
          <Select.Option value="openai">
            <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
              <strong>🧠 OpenAI (gpt-4)</strong>
              <small style={{ color: '#1890ff' }}>Most capable • Best reasoning • Requires API key</small>
            </div>
          </Select.Option>
          <Select.Option value="anthropic">
            <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
              <strong>✨ Anthropic (claude-3.5-sonnet)</strong>
              <small style={{ color: '#722ed1' }}>Balanced • Excellent code • Requires API key</small>
            </div>
          </Select.Option>
          <Select.Option value="google">
            <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
              <strong>🌐 Google (gemini-pro)</strong>
              <small style={{ color: '#fa8c16' }}>Multimodal • Versatile • Requires API key</small>
            </div>
          </Select.Option>
        </Select>
        
        <div className="language-toggle">
          <Button
            type={language === 'R' ? 'primary' : 'default'}
            onClick={() => onLanguageChange('R' as ProgrammingLanguage)}
            className={language === 'R' ? 'active' : ''}
          >
            R
          </Button>
          <Button
            type={language === 'SAS' ? 'primary' : 'default'}
            onClick={() => onLanguageChange('SAS' as ProgrammingLanguage)}
            className={language === 'SAS' ? 'active' : ''}
          >
            SAS
          </Button>
        </div>

        <Button icon={<SettingOutlined />} type="text" className="icon-btn" />
        <Button icon={<BarChartOutlined />} type="text" className="icon-btn" />
        <Button icon={<UserOutlined />} type="text" className="icon-btn" />
      </Space>
    </div>
  );
};

export default Header;
