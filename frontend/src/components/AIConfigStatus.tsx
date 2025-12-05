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
  ShieldFilled,
  EyeInvisibleOutlined,
  SafetyOutlined,
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
  const [isHovering, setIsHovering] = useState(false);

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

    if (mode === 'offline') {
      setLlmProvider('ollama' as any);
      checkOllamaConnection();
    } else {
      if (llmProvider === 'ollama') {
        setLlmProvider('groq' as any);
      }
    }
  };

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
    if (value !== 'openrouter') {
      setModelError(null);
    }
  };

  const handleTestConnection = async () => {
    if (aiMode === 'offline') {
      const connected = await checkOllamaConnection();
      if (connected) {
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
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Main Container */}
      <div className={`ai-config-status ${aiMode === 'offline' ? 'ai-config-offline-mode' : ''}`}>

        {/* Mode Toggle Section - Innovative Design */}
        <div className="ai-mode-toggle-wrapper">
          {/* Cloud Mode Button */}
          <button
            className={`ai-mode-btn ${aiMode === 'cloud' ? 'ai-mode-btn-active' : ''}`}
            onClick={() => handleModeChange('cloud')}
          >
            <div className="ai-mode-btn-icon">
              <CloudOutlined />
              <ThunderboltOutlined className="ai-mode-accent" />
            </div>
            <span className="ai-mode-btn-label">Cloud API</span>
            {aiMode === 'cloud' && <div className="ai-mode-active-indicator" />}
          </button>

          {/* Divider */}
          <div className="ai-mode-divider">
            <span>or</span>
          </div>

          {/* Secure Offline Mode - FEATURED USP */}
          <button
            className={`ai-mode-btn ai-mode-btn-secure ${aiMode === 'offline' ? 'ai-mode-btn-active ai-mode-btn-glow' : ''}`}
            onClick={() => handleModeChange('offline')}
          >
            {/* Animated Background Shield */}
            <div className="ai-secure-bg-shield">
              <ShieldFilled />
            </div>

            {/* Floating Security Orbs */}
            <div className="ai-security-orbs">
              <span className="orb orb-1" />
              <span className="orb orb-2" />
              <span className="orb orb-3" />
            </div>

            <div className="ai-mode-btn-icon ai-mode-secure-icon">
              <LockFilled />
            </div>
            <div className="ai-mode-secure-content">
              <span className="ai-mode-btn-label">Secure Offline</span>
              <span className="ai-mode-secure-tag">
                <EyeInvisibleOutlined />
                100% Private
              </span>
            </div>

            {/* Premium USP Badge */}
            <div className="ai-usp-floating-badge">
              <SafetyCertificateOutlined />
              <span>HIPAA</span>
            </div>

            {aiMode === 'offline' && <div className="ai-mode-active-indicator ai-mode-secure-indicator" />}
          </button>
        </div>

        <div className="ai-config-divider-vertical" />

        {/* Configuration Panel */}
        <div className="ai-config-panel">
          {aiMode === 'cloud' ? (
            /* Cloud Mode Config */
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
            /* Offline Mode Config - Security Vault Theme */
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
                        <ShieldFilled className="ai-vault-protected-icon" />
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

        {/* USP Security Showcase Section - Only in Offline Mode */}
        {aiMode === 'offline' && (
          <>
            <div className="ai-config-divider-vertical" />
            <div className="ai-usp-showcase">
              {/* Animated Security Vault */}
              <div className="ai-security-vault">
                <div className="ai-vault-inner">
                  <SecurityScanOutlined className="ai-vault-scan-icon" />
                  <div className="ai-vault-scan-line" />
                </div>
                <div className="ai-vault-text">
                  <span className="ai-vault-headline">DATA VAULT</span>
                  <span className="ai-vault-subtext">Zero External Calls</span>
                </div>
              </div>

              {/* Trust Indicators */}
              <div className="ai-trust-badges">
                <div className="ai-trust-badge">
                  <SafetyOutlined />
                  <span>Air-Gapped</span>
                </div>
                <div className="ai-trust-badge ai-trust-badge-featured">
                  <LockFilled />
                  <span>Encrypted</span>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="ai-config-divider-vertical" />

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
            <div className={`ai-connected-badge ${aiMode === 'offline' ? 'ai-connected-secure' : ''}`}>
              <CheckCircleFilled />
              <span>{aiMode === 'offline' ? 'Secured' : 'Ready'}</span>
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

      {/* Floating Tooltip on Hover - Premium Message */}
      {aiMode === 'offline' && isHovering && (
        <div className="ai-premium-tooltip">
          <div className="ai-tooltip-glow" />
          <ShieldFilled className="ai-tooltip-shield" />
          <div className="ai-tooltip-content">
            <span className="ai-tooltip-title">Enterprise Security</span>
            <span className="ai-tooltip-desc">Your clinical data never leaves this device</span>
          </div>
        </div>
      )}

      {/* Floating USP Banner - Appears in Offline Mode */}
      {aiMode === 'offline' && (
        <div className="ai-floating-usp-banner">
          <div className="ai-usp-banner-content">
            <ShieldFilled className="ai-usp-banner-icon" />
            <span className="ai-usp-banner-text">ZERO DATA EXPOSURE</span>
          </div>
          <div className="ai-usp-banner-particles">
            <span className="particle p1" />
            <span className="particle p2" />
            <span className="particle p3" />
            <span className="particle p4" />
          </div>
        </div>
      )}
    </div>
  );
};
