import React, { useEffect, useState } from 'react';
import { Select, Button, Tooltip, message } from 'antd';
import {
  RobotOutlined,
  RocketOutlined,
  CheckCircleFilled,
  CheckOutlined,
  ApiOutlined,
  LoadingOutlined,
  WarningOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
import './AIConfigStatus.css';

const { Option } = Select;

interface AIConfigStatusProps {
  className?: string;
}

const PROVIDERS = [
  { value: 'groq', label: 'Groq', icon: <RocketOutlined /> },
  { value: 'openai', label: 'OpenAI', icon: <RobotOutlined /> },
  { value: 'anthropic', label: 'Anthropic', icon: <RobotOutlined /> },
  { value: 'google', label: 'Google', icon: <RobotOutlined /> },
  { value: 'openrouter', label: 'OpenRouter', icon: <RocketOutlined /> },
];

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
  } = useProjectStore();

  const [loadingModels, setLoadingModels] = useState(false);
  const [, setModelError] = useState<string | null>(null);

  useEffect(() => {
    if (llmProvider !== 'openrouter') {
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
          setModelError('No OpenRouter models available. Verify your API key.');
          return;
        }

        setAvailableModels(models);

        if (!selectedModel) {
          setSelectedModel(models[0].id);
        }
      } catch (error: any) {
        if (!isMounted) return;
        const errorMsg = error.response?.data?.detail || error.message || 'Failed to load OpenRouter models';
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
  }, [llmProvider, availableModels.length, selectedModel, setAvailableModels, setSelectedModel]);

  const handleProviderChange = (value: string) => {
    setLlmProvider(value as any);
    if (value !== 'openrouter') {
      setModelError(null);
    }
  };

  const handleTestConnection = async () => {
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
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to connect to provider';
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

  return (
    <div className={`ai-config-status ${className || ''}`}>
      {/* Icon and Label Section */}
      <div className="ai-config-section">
        <RobotOutlined className="ai-config-icon" />
        <span className="ai-config-label">AI Configuration</span>
      </div>
      
      <div className="ai-config-divider" />
      
      {/* Provider Selection Section */}
      <div className="ai-config-section">
        <Select
          value={llmProvider}
          onChange={handleProviderChange}
          className="ai-provider-select-compact"
          dropdownMatchSelectWidth={180}
          size="small"
          suffixIcon={<DownOutlined style={{ fontSize: 10, color: '#64748b' }} />}
        >
          {PROVIDERS.map((provider) => (
            <Option key={provider.value} value={provider.value}>
              <div className="provider-option">
                {provider.icon}
                <span>{provider.label}</span>
              </div>
            </Option>
          ))}
        </Select>

        {llmProvider === 'openrouter' && (
          <>
            <div className="ai-config-separator" />
            <Select
              showSearch
              value={selectedModel || undefined}
              onChange={(value) => setSelectedModel(value)}
              className="ai-model-select-compact"
              loading={loadingModels}
              placeholder="Select model"
              optionFilterProp="label"
              size="small"
              suffixIcon={<DownOutlined style={{ fontSize: 10, color: '#64748b' }} />}
              notFoundContent={
                loadingModels ? (
                  <div className="ai-model-loading">
                    <LoadingOutlined style={{ marginRight: 8 }} />
                    Loading...
                  </div>
                ) : (
                  <div className="ai-model-loading">No models</div>
                )
              }
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
          </>
        )}
      </div>

      <div className="ai-config-divider" />

      {/* Status Section */}
      <div className="ai-config-section">
        <Tooltip title={llmConnectionMessage || 'Test AI connection'}>
          <Button
            className="ai-config-test-button-compact"
            type={llmConnectionStatus === 'connected' ? 'primary' : 'default'}
            danger={llmConnectionStatus === 'failed'}
            loading={llmConnectionStatus === 'testing'}
            onClick={handleTestConnection}
            size="small"
            icon={
              llmConnectionStatus === 'connected'
                ? <CheckOutlined />
                : llmConnectionStatus === 'failed'
                ? <WarningOutlined />
                : <ApiOutlined />
            }
          />
        </Tooltip>

        {llmConnectionStatus === 'connected' && (
          <div className="ai-status-badge">
            <CheckCircleFilled />
            <span>Ready</span>
          </div>
        )}
      </div>
    </div>
  );
};


