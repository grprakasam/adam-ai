import { Select, Button, Space, Tag } from 'antd';
import { SettingOutlined, BarChartOutlined, UserOutlined, HomeOutlined } from '@ant-design/icons';
import type { ProgrammingLanguage, LLMProvider } from '../types';
import './Header.css';
import { useEffect, useState } from 'react';
import api from '../services/api';

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

  return (
    <div className="header">
      <div className="header-left">
        {onBackToLanding && (
          <Button
            className="back-button"
            icon={<HomeOutlined />}
            onClick={onBackToLanding}
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
