import React, { useEffect, useState, useCallback } from 'react';
import { Select, Button, Tooltip, message } from 'antd';
import {
  RobotOutlined,
  RocketOutlined,
  CheckCircleFilled,
  CheckOutlined,
  ApiOutlined,
  WarningOutlined,
  DownOutlined,
  CloudOutlined,
  SafetyCertificateOutlined,
  DesktopOutlined,
  DisconnectOutlined,
  ThunderboltOutlined,
  LockFilled,
  EyeInvisibleOutlined,
  SecurityScanOutlined,
} from '@ant-design/icons';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
import './AIConfigStatus.css';

const { Option } = Select;

interface AIConfigStatusProps {
  className?: string;
}

// Cloud API Providers
const CLOUD_PROVIDERS = [
  { value: 'groq', label: 'Groq', icon: <RocketOutlined /> },
  { value: 'openai', label: 'OpenAI', icon: <RobotOutlined /> },
  { value: 'anthropic', label: 'Anthropic', icon: <RobotOutlined /> },
  { value: 'google', label: 'Google', icon: <RobotOutlined /> },
  { value: 'openrouter', label: 'OpenRouter', icon: <RocketOutlined /> },
];

// Offline Ollama Models (placeholder - will be dynamically loaded)
const DEFAULT_OLLAMA_MODELS = [
  { name: 'llama3.2', label: 'Llama 3.2 (8B)' },
  { name: 'codellama', label: 'Code Llama' },
  { name: 'mistral', label: 'Mistral 7B' },
  { name: 'mixtral', label: 'Mixtral 8x7B' },
];

type AIMode = 'cloud' | 'offline';
type OllamaConnectionStatus = 'unchecked' | 'checking' | 'connected' | 'unavailable';

export const AIConfigStatus: React.FC<AIConfigStatusProps> = ({ className }) => {
  const {
    llmProvider,
    setLlmProvider,
    llmConnectionStatus,
    llmConnectionMessage,
    setLlmConnectionStatus,
    selectedModel,
    setSelectedModel,
    availableModels,
    setAvailableModels,
    executionMode,
    setExecutionMode,
  } = useProjectStore();

  // Local state for AI mode and Ollama
  const [aiMode, setAiMode] = useState<AIMode>(executionMode === 'local' ? 'offline' : 'cloud');
  const [ollamaStatus, setOllamaStatus] = useState<OllamaConnectionStatus>('unchecked');
  const [ollamaModels, setOllamaModels] = useState(DEFAULT_OLLAMA_MODELS);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<string>('llama3.2');
  const [loadingModels, setLoadingModels] = useState(false);
  const [, setModelError] = useState<string | null>(null);

  // State to track successful connection details for the UI card
  const [activeConnectionDetails, setActiveConnectionDetails] = useState<{
    connected: boolean;
    provider?: string;
    model?: string;
    isOffline: boolean;
  } | null>(null);

  // Check Ollama connection
  const checkOllamaConnection = useCallback(async () => {
    setOllamaStatus('checking');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch('http://localhost:11434/api/tags', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.models && Array.isArray(data.models)) {
          setOllamaModels(data.models.map((m: any) => ({
            name: m.name,
            label: m.name,
          })));
          if (data.models.length > 0 && !selectedOllamaModel) {
            setSelectedOllamaModel(data.models[0].name);
          }
        }
        setOllamaStatus('connected');
        return true;
      } else {
        setOllamaStatus('unavailable');
        return false;
      }
    } catch (error) {
      setOllamaStatus('unavailable');
      return false;
    }
  }, [selectedOllamaModel]);

  // Handle mode change
  const handleModeChange = (mode: AIMode) => {
    setAiMode(mode);
    setExecutionMode(mode === 'cloud' ? 'api' : 'local');
    setActiveConnectionDetails(null); // Reset status card on mode switch

    if (mode === 'offline') {
      setLlmProvider('ollama' as any);
      setSelectedModel(selectedOllamaModel); // Sync current ollama model to store
      checkOllamaConnection();
    } else {
      setSelectedModel(''); // Clear model when switching back to cloud initially
      if (llmProvider === 'ollama') {
        setLlmProvider('groq' as any);
      }
    }
  };

  // Sync Ollama model selection to global store
  useEffect(() => {
    if (aiMode === 'offline') {
      setSelectedModel(selectedOllamaModel);
    }
  }, [selectedOllamaModel, aiMode, setSelectedModel]);

  // Fetch OpenRouter models when selected
  useEffect(() => {
    if (llmProvider !== 'openrouter' || aiMode !== 'cloud') {
      setModelError(null);
      return;
    }

    if (availableModels.length > 0) {
      return;
    }

    let isMounted = true;

    const fetchModels = async () => {
      setLoadingModels(true);
      setModelError(null);

      try {
        const models = await adamApi.getOpenRouterModels();
        if (!isMounted) return;

        if (!models || models.length === 0) {
          setModelError('No OpenRouter models available.');
          return;
        }

        setAvailableModels(models);

        if (!selectedModel) {
          setSelectedModel(models[0].id);
        }
      } catch (error: any) {
        if (!isMounted) return;
        const errorMsg = error.response?.data?.detail || error.message || 'Failed to load models';
        setModelError(errorMsg);
      } finally {
        if (isMounted) {
          setLoadingModels(false);
        }
      }
    };

    fetchModels();

    return () => {
      isMounted = false;
    };
  }, [llmProvider, aiMode, availableModels.length, selectedModel, setAvailableModels, setSelectedModel]);

  // Check Ollama on mount if in offline mode
  useEffect(() => {
    if (aiMode === 'offline' && ollamaStatus === 'unchecked') {
      checkOllamaConnection();
    }
  }, [aiMode, ollamaStatus, checkOllamaConnection]);

  const handleProviderChange = (value: string) => {
    setLlmProvider(value as any);
    setSelectedModel(''); // Clear selected model when provider changes to prevent stale data
    setActiveConnectionDetails(null);
    if (value !== 'openrouter') {
      setModelError(null);
    }
  };

  const handleTestConnection = async () => {
    if (aiMode === 'offline') {
      const connected = await checkOllamaConnection();
      if (connected) {
        setActiveConnectionDetails({
          connected: true,
          model: selectedOllamaModel,
          isOffline: true
        });
        message.success({
          content: (
            <span>
              <CheckCircleFilled style={{ color: '#52c41a', marginRight: 8 }} />
              Ollama is running locally!
            </span>
          ),
          duration: 3,
        });
      } else {
        setActiveConnectionDetails(null);
        message.error({
          content: (
            <span>
              <WarningOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
              Ollama not detected. Make sure it's running on localhost:11434
            </span>
          ),
          duration: 5,
        });
      }
      return;
    }

    setLlmConnectionStatus('testing', 'Testing connection...');

    try {
      const result = await adamApi.testLLMConnection(
        llmProvider,
        llmProvider === 'openrouter' ? selectedModel || undefined : undefined
      );

      if (result.success) {
        setLlmConnectionStatus('connected', result.message);
        setActiveConnectionDetails({
          connected: true,
          provider: llmProvider,
          model: llmProvider === 'openrouter' ? selectedModel : undefined,
          isOffline: false
        });
        message.success({
          content: (
            <span>
              <CheckCircleFilled style={{ color: '#52c41a', marginRight: 8 }} />
              {result.message}
            </span>
          ),
          duration: 3,
        });
      } else {
        setLlmConnectionStatus('failed', result.message);
        setActiveConnectionDetails(null);
        message.error({
          content: (
            <span>
              <WarningOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
              {result.message}
            </span>
          ),
          duration: 5,
        });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to connect';
      setLlmConnectionStatus('failed', errorMsg);
      setActiveConnectionDetails(null);
      message.error({
        content: (
          <span>
            <WarningOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
            {errorMsg}
          </span>
        ),
        duration: 5,
      });
    }
  };

  const isConnected = aiMode === 'cloud'
    ? llmConnectionStatus === 'connected'
    : ollamaStatus === 'connected';

  const isTesting = aiMode === 'cloud'
    ? llmConnectionStatus === 'testing'
    : ollamaStatus === 'checking';

  const isFailed = aiMode === 'cloud'
    ? llmConnectionStatus === 'failed'
    : ollamaStatus === 'unavailable';

  return (
    <div
      className={`ai-config-wrapper ${aiMode === 'offline' ? 'ai-config-offline-active' : ''} ${className || ''}`}
    >
      <div className={`ai-config-status ${aiMode === 'offline' ? 'ai-config-offline-mode' : ''}`}>

        {/* Row 1: Title and Modes */}
        <div className="ai-config-row-top" style={{ display: 'flex', alignItems: 'center', width: '100%', borderBottom: '1px solid #f0f0f0' }}>
          <div className="ai-section-title">AI Settings</div>
          <div className="ai-mode-toggle-wrapper">
            <button
              className={`ai-mode-btn ${aiMode === 'cloud' ? 'ai-mode-btn-active' : ''}`}
              onClick={() => handleModeChange('cloud')}
            >
              <div className="ai-mode-btn-icon">
                <CloudOutlined />
                <ThunderboltOutlined className="ai-mode-accent" />
              </div>
              <span className="ai-mode-btn-label">Cloud AI</span>
              {aiMode === 'cloud' && <div className="ai-mode-active-indicator" />}
            </button>
            <div className="ai-mode-divider"><span>or</span></div>
            <button
              className={`ai-mode-btn ai-mode-btn-secure ${aiMode === 'offline' ? 'ai-mode-btn-active ai-mode-btn-glow' : ''}`}
              onClick={() => handleModeChange('offline')}
            >
              <div className="ai-secure-bg-shield"><SafetyCertificateOutlined /></div>
              <div className="ai-security-orbs">
                <span className="orb orb-1" />
                <span className="orb orb-2" />
                <span className="orb orb-3" />
              </div>
              <div className="ai-mode-btn-icon ai-mode-secure-icon"><LockFilled /></div>
              <div className="ai-mode-secure-content">
                <span className="ai-mode-btn-label">Secure Offline AI</span>
                <span className="ai-mode-secure-tag"><EyeInvisibleOutlined /> 100% Private</span>
              </div>
              {aiMode === 'offline' && <div className="ai-mode-active-indicator ai-mode-secure-indicator" />}
            </button>
          </div>
        </div>

        {/* Row 2: Controls and Status */}
        <div className="ai-config-row-bottom" style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '4px 0' }}>
          <div className="ai-config-panel">
            {aiMode === 'cloud' ? (
              <div className="ai-cloud-config">
                <Select
                  value={llmProvider}
                  onChange={handleProviderChange}
                  className="ai-provider-select"
                  dropdownMatchSelectWidth={180}
                  size="small"
                  suffixIcon={<DownOutlined style={{ fontSize: 10, color: '#64748b' }} />}
                >
                  {CLOUD_PROVIDERS.map((provider) => (
                    <Option key={provider.value} value={provider.value}>
                      <div className="provider-option">
                        {provider.icon}
                        <span>{provider.label}</span>
                      </div>
                    </Option>
                  ))}
                </Select>
                {llmProvider === 'openrouter' && (
                  <Select
                    showSearch
                    value={selectedModel || undefined}
                    onChange={(value) => setSelectedModel(value)}
                    className="ai-model-select"
                    loading={loadingModels}
                    placeholder="Model"
                    optionFilterProp="label"
                    size="small"
                    dropdownMatchSelectWidth={350}
                    suffixIcon={<DownOutlined style={{ fontSize: 10, color: '#64748b' }} />}
                  >
                    {availableModels.map((model) => (
                      <Option key={model.id} value={model.id} label={model.name}>
                        <div className="provider-option">
                          <RocketOutlined />
                          <span>{model.name}</span>
                        </div>
                      </Option>
                    ))}
                  </Select>
                )}
              </div>
            ) : (
              <div className="ai-offline-config">
                <div className="ai-vault-status-card">
                  <div className="ai-vault-icon-container">
                    <DesktopOutlined className="ai-vault-icon" />
                    <div className="ai-vault-pulse-ring" />
                    <div className="ai-vault-pulse-ring ai-vault-pulse-ring-2" />
                  </div>
                  <div className="ai-vault-info">
                    <span className="ai-vault-title">Local AI Engine</span>
                    <span className="ai-vault-subtitle">
                      {ollamaStatus === 'connected' ? (
                        <>
                          <SafetyCertificateOutlined className="ai-vault-protected-icon" />
                          Protected
                        </>
                      ) : ollamaStatus === 'checking' ? (
                        'Securing...'
                      ) : (
                        'Checking...'
                      )}
                    </span>
                  </div>
                </div>
                <Select
                  value={selectedOllamaModel}
                  onChange={(value) => setSelectedOllamaModel(value)}
                  className="ai-ollama-select"
                  dropdownMatchSelectWidth={140}
                  size="small"
                  disabled={ollamaStatus !== 'connected'}
                  suffixIcon={<DownOutlined style={{ fontSize: 10 }} />}
                >
                  {ollamaModels.map((model) => (
                    <Option key={model.name} value={model.name}>
                      <div className="provider-option">
                        <RobotOutlined />
                        <span>{model.label || model.name}</span>
                      </div>
                    </Option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          {/* Connection Status */}
          <div className="ai-status-section">
            <Tooltip title={
              aiMode === 'offline'
                ? (ollamaStatus === 'connected' ? 'Secure connection active' : 'Check connection')
                : (llmConnectionMessage || 'Test connection')
            }>
              <Button
                className={`ai-test-button ${aiMode === 'offline' ? 'ai-test-secure' : ''} ${isConnected ? 'ai-test-connected' : ''}`}
                type={isConnected ? 'primary' : 'default'}
                danger={isFailed}
                loading={isTesting}
                onClick={handleTestConnection}
                size="small"
                icon={
                  isConnected
                    ? <CheckOutlined />
                    : isFailed
                      ? <DisconnectOutlined />
                      : <ApiOutlined />
                }
              />
            </Tooltip>
            {isConnected && (
              <div
                className={`header-status-badge ${aiMode === 'offline' ? 'ai-connected-badge ai-connected-secure badge-connected' : ''}`}
                style={aiMode === 'cloud' ? {
                  margin: 0,
                  padding: '0 8px',
                  background: 'transparent',
                  border: 'none',
                  boxShadow: 'none',
                  fontSize: '11px',
                  color: '#8c8c8c'
                } : { margin: 0 }}
              >
                <CheckCircleFilled style={{ color: '#52c41a', fontSize: '14px' }} />
                {aiMode === 'cloud' && (
                  <span style={{ color: '#8c8c8c', fontWeight: 500, fontSize: '11px' }}>
                    Connected to {llmProvider ? llmProvider.toUpperCase() : 'AI'} AI Service
                    {selectedModel ? ` (${selectedModel})` : ''}
                  </span>
                )}
                {/* Green glowing indicator */}
                {aiMode === 'cloud' && <span className="badge-dot dot-green" style={{ marginLeft: 6, boxShadow: '0 0 6px #52c41a', width: '6px', height: '6px' }}></span>}
              </div>
            )}
            {isFailed && aiMode === 'offline' && (
              <Tooltip title="Start Ollama to enable secure mode">
                <div className="ai-disconnected-badge">
                  <DisconnectOutlined />
                  <span>Offline</span>
                </div>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Row 3: Live Connection Status Card (Appears after connection) */}
        {activeConnectionDetails && activeConnectionDetails.connected && (
          <div className={`ai-active-status-card ${activeConnectionDetails.isOffline ? 'status-card-secure' : 'status-card-cloud'}`}>
            <div className="status-card-icon">
              {activeConnectionDetails.isOffline ? (
                <SafetyCertificateOutlined style={{ fontSize: '24px', color: '#10b981' }} />
              ) : (
                <CheckCircleFilled style={{ fontSize: '24px', color: '#3b82f6' }} />
              )}
            </div>
            <div className="status-card-content">
              <div className="status-card-title">
                {activeConnectionDetails.isOffline ? 'Local AI Engine Active' : 'Cloud Connection Established'}
              </div>
              <div className="status-card-message">
                {activeConnectionDetails.isOffline ? (
                  <span>
                    Data Vault Secured. <span style={{ fontWeight: 700, color: '#10b981' }}>0% External Traffic.</span>
                    <br />Running {activeConnectionDetails.model} locally.
                  </span>
                ) : (
                  <span>
                    Connected to <span style={{ fontWeight: 600 }}>{(activeConnectionDetails.provider || 'AI Provider').toUpperCase()}</span>.
                    <br />Ready to process requests securely.
                  </span>
                )}
              </div>
            </div>
            <div className="status-pulse-indicator">
              <span className="pulse-dot"></span>
              <span className="pulse-ring"></span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
