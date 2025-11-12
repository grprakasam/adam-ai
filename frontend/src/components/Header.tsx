import { Select, Button, Space, Tag } from 'antd';
import { SettingOutlined, BarChartOutlined, UserOutlined, HomeOutlined } from '@ant-design/icons';
import type { ProgrammingLanguage, LLMProvider } from '../types';
import './Header.css';
import { useEffect, useState } from 'react';
import api from '../services/api';
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
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const getCompletionPercentage = useProjectStore((state) => state.getCompletionPercentage);
  const resetWorkspace = useProjectStore((state) => state.resetWorkspace);

  useEffect(() => {
    let mounted = true;
    api.getLLMDefaults()
      .then((data) => {
        if (!mounted) return;
        setActiveProvider(data.default_provider || null);
        setActiveModel(data.default_model || null);
      })
      .catch(() => {
        if (!mounted) return;
        setActiveProvider(null);
        setActiveModel(null);
      });
    return () => { mounted = false; };
  }, []);

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
      
      <Space size="middle" className="header-controls">
        {activeProvider && activeModel && (
          <div className="llm-indicator">
            <Tag color="blue">{activeProvider}</Tag>
            <Tag>{activeModel}</Tag>
          </div>
        )}
        <Select
          value={llmProvider}
          onChange={onLlmProviderChange}
          className="provider-selector"
          options={[
            { value: 'openai', label: 'OpenAI GPT-4' },
            { value: 'anthropic', label: 'Claude 3.5 Sonnet' },
            { value: 'google', label: 'Google Gemini (gemini-2.5-flash)' },
          ]}
        />
        
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
