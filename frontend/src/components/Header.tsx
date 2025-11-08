import { Select, Button, Space } from 'antd';
import { SettingOutlined, BarChartOutlined, UserOutlined } from '@ant-design/icons';
import type { ProgrammingLanguage, LLMProvider } from '../types';
import './Header.css';

interface HeaderProps {
  language: ProgrammingLanguage;
  llmProvider: LLMProvider;
  onLanguageChange: (language: ProgrammingLanguage) => void;
  onLlmProviderChange: (provider: LLMProvider) => void;
}

const Header = ({ language, llmProvider, onLanguageChange, onLlmProviderChange }: HeaderProps) => {
  return (
    <div className="header">
      <div className="header-title">ADAM AI Code Generator</div>
      
      <Space size="middle" className="header-controls">
        <Select
          value={llmProvider}
          onChange={onLlmProviderChange}
          className="provider-selector"
          options={[
            { value: 'openai', label: 'OpenAI GPT-4' },
            { value: 'anthropic', label: 'Claude 3.5 Sonnet' },
            { value: 'google', label: 'Google Gemini Pro' },
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
