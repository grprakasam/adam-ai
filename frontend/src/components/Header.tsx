import { Select, Button, Space, message, Tooltip } from 'antd';
import { SettingOutlined, BarChartOutlined, UserOutlined, HomeOutlined, ApiOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import type { ProgrammingLanguage, LLMProvider } from '../types';
import './Header.css';
import { useProjectStore } from '../store/projectStore';
import { showNavigationConfirmation } from './ConfirmationDialog';
import { useEffect, useState } from 'react';
import { adamApi } from '../services/api';
import { AlertCircle } from 'lucide-react';

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
  const selectedModel = useProjectStore((state) => state.selectedModel);
  const availableModels = useProjectStore((state) => state.availableModels);
  const setSelectedModel = useProjectStore((state) => state.setSelectedModel);
  const setAvailableModels = useProjectStore((state) => state.setAvailableModels);
  const llmConnectionStatus = useProjectStore((state) => state.llmConnectionStatus);
  const llmConnectionMessage = useProjectStore((state) => state.llmConnectionMessage);
  const setLlmConnectionStatus = useProjectStore((state) => state.setLlmConnectionStatus);
  
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  // Fetch OpenRouter models when provider is OpenRouter
  useEffect(() => {
    const fetchModels = async () => {
      if (llmProvider === 'openrouter') {
        if (availableModels.length > 0) {
          console.log('Models already loaded:', availableModels.length);
          return;
        }
        
        console.log('Fetching OpenRouter models...');
        setLoadingModels(true);
        setModelError(null);
        
        try {
          const models = await adamApi.getOpenRouterModels();
          console.log('Received models:', models?.length || 0, models);
          
          if (!models || models.length === 0) {
            setModelError('No models available. Check OpenRouter API key configuration.');
            console.error('No models returned from API');
            return;
          }
          
          setAvailableModels(models);
          
          // Set default model if none selected
          if (!selectedModel && models.length > 0) {
            console.log('Setting default model:', models[0].id);
            setSelectedModel(models[0].id);
          }
        } catch (error: any) {
          const errorMsg = error.response?.data?.detail || error.message || 'Failed to load models';
          console.error('Failed to fetch OpenRouter models:', errorMsg, error);
          setModelError(errorMsg);
        } finally {
          setLoadingModels(false);
        }
      }
    };
    
    fetchModels();
  }, [llmProvider, availableModels.length, selectedModel, setAvailableModels, setSelectedModel]);

  // Test LLM connection
  const handleTestConnection = async () => {
    setLlmConnectionStatus('testing', 'Testing connection...');
    
    try {
      console.log('Testing connection to:', llmProvider, 'model:', selectedModel);
      
      const result = await adamApi.testLLMConnection(
        llmProvider,
        llmProvider === 'openrouter' ? selectedModel || undefined : undefined
      );
      
      if (result.success) {
        setLlmConnectionStatus('connected', result.message);
        message.success({
          content: (
            <span>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              {result.message}
            </span>
          ),
          duration: 3,
        });
      } else {
        setLlmConnectionStatus('failed', result.message);
        message.error({
          content: (
            <span>
              <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
              {result.message}
            </span>
          ),
          duration: 5,
        });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Connection test failed';
      setLlmConnectionStatus('failed', errorMsg);
      message.error({
        content: (
          <span>
            <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
            {errorMsg}
          </span>
        ),
        duration: 5,
      });
      console.error('Connection test failed:', error);
    }
  };

  // Provider information mapping
  const getOpenRouterModelDisplay = () => {
    if (!selectedModel) return 'Select Model';
    const model = availableModels.find(m => m.id === selectedModel);
    if (!model) return 'Select Model';
    // Truncate long model names for display
    const name = model.name;
    return name.length > 25 ? name.substring(0, 22) + '...' : name;
  };

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
      model: 'gemini-1.5-flash',
      description: '🌐 Multimodal capabilities • Good for varied tasks',
      color: 'orange'
    },
    'openrouter': {
      name: 'OpenRouter',
      model: getOpenRouterModelDisplay(),
      description: '🌟 Access to 100+ models • Pay-as-you-go • No quotas',
      color: 'cyan'
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
      
      {/* AI Model Settings Section */}
      <div className="ai-model-settings-panel">
        <div className="settings-header">
          <SettingOutlined className="settings-icon" />
          <span className="settings-title">AI Model Settings</span>
        </div>

        {/* Provider Selection */}
        <div className="settings-group">
          <label className="setting-label">Provider</label>
          <Select
            value={llmProvider}
            onChange={onLlmProviderChange}
            className="provider-selector-refined"
            placeholder="Select LLM Provider"
          >
            <Select.Option value="groq">
              <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
                <strong>🚀 Groq</strong>
                <small style={{ color: '#52c41a' }}>280 tokens/sec • Free</small>
              </div>
            </Select.Option>
            <Select.Option value="openai">
              <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
                <strong>🧠 OpenAI</strong>
                <small style={{ color: '#1890ff' }}>GPT-4 • Premium</small>
              </div>
            </Select.Option>
            <Select.Option value="anthropic">
              <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
                <strong>✨ Anthropic</strong>
                <small style={{ color: '#722ed1' }}>Claude 3.5 • Advanced</small>
              </div>
            </Select.Option>
            <Select.Option value="google">
              <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
                <strong>🌐 Google</strong>
                <small style={{ color: '#fa8c16' }}>Gemini • Multimodal</small>
              </div>
            </Select.Option>
            <Select.Option value="openrouter">
              <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
                <strong>🌟 OpenRouter</strong>
                <small style={{ color: '#13c2c2' }}>100+ models • Flexible</small>
              </div>
            </Select.Option>
          </Select>
        </div>

        {/* Model Selection (OpenRouter only) */}
        {llmProvider === 'openrouter' && (
          <div className="settings-group">
            <label className="setting-label">Model</label>
            <Select
              value={selectedModel}
              onChange={(value) => setSelectedModel(value)}
              showSearch
              optionFilterProp="label"
              loading={loadingModels}
              className="model-selector-refined"
              notFoundContent={
                modelError ? (
                  <div style={{ padding: '12px', color: '#ff4d4f', fontSize: '12px' }}>
                    <AlertCircle size={14} style={{ marginRight: 4 }} />
                    {modelError}
                  </div>
                ) : (
                  <div style={{ padding: '12px', color: '#999', fontSize: '12px' }}>
                    No models available
                  </div>
                )
              }
            >
              {availableModels.map(model => (
                <Select.Option value={model.id} label={model.name} key={model.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{model.name}</div>
                      {model.context_length && (
                        <small style={{ color: '#999' }}>
                          {Math.round(model.context_length / 1000)}K context
                        </small>
                      )}
                    </div>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </div>
        )}

        {/* Connection Status and Actions */}
        <div className="settings-actions">
          <Tooltip title={llmConnectionMessage || 'Validate connection to LLM provider'}>
            <Button
              icon={
                llmConnectionStatus === 'testing' ? <LoadingOutlined /> :
                llmConnectionStatus === 'connected' ? <CheckCircleOutlined /> :
                llmConnectionStatus === 'failed' ? <CloseCircleOutlined /> :
                <ApiOutlined />
              }
              onClick={handleTestConnection}
              loading={llmConnectionStatus === 'testing'}
              type={llmConnectionStatus === 'connected' ? 'primary' : 'default'}
              danger={llmConnectionStatus === 'failed'}
              className="connection-test-button"
            >
              {llmConnectionStatus === 'testing' ? 'Testing...' : 
               llmConnectionStatus === 'connected' ? 'Connected' : 
               llmConnectionStatus === 'failed' ? 'Failed' : 
               'Test Connection'}
            </Button>
          </Tooltip>

          {llmConnectionStatus === 'connected' && (
            <div className="connection-status-indicator">
              <span className="status-dot connected"></span>
              <span className="status-text">Ready</span>
            </div>
          )}
          {llmConnectionStatus === 'failed' && (
            <div className="connection-status-indicator">
              <span className="status-dot failed"></span>
              <span className="status-text">Error</span>
            </div>
          )}
        </div>
      </div>

      {/* Language and other controls */}
      <Space size="middle" className="header-right-controls">
        <div className="language-toggle">
          <Button
            type={language === 'R' ? 'primary' : 'default'}
            onClick={() => onLanguageChange('R' as ProgrammingLanguage)}
            className={language === 'R' ? 'active' : ''}
            size="small"
          >
            R
          </Button>
          <Button
            type={language === 'SAS' ? 'primary' : 'default'}
            onClick={() => onLanguageChange('SAS' as ProgrammingLanguage)}
            className={language === 'SAS' ? 'active' : ''}
            size="small"
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
