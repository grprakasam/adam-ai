import React, { useEffect, useState } from 'react';
import { Modal, Progress, Typography, Tag, Divider, Spin } from 'antd';
import {
  CheckCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  ApiOutlined
} from '@ant-design/icons';
import { Zap, X } from 'lucide-react';
import './CodeGenerationProgressModal.css';

const { Text, Title } = Typography;

interface VariableStatus {
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  batchId?: number;
  completedAt?: number;
}

interface CodeGenerationProgressModalProps {
  visible: boolean;
  total: number;
  completed: number;
  currentStatus: string;
  status: string;
  variableName?: string;
  batchSize?: number;
  variables?: string[];  // List of variables in current batch
  elapsedSeconds: number;
  etaSeconds: number;
  onCancel: () => void;
  llmProvider?: string;
  language?: string;
  dataset?: string;
}

export const CodeGenerationProgressModal: React.FC<CodeGenerationProgressModalProps> = ({
  visible,
  total,
  completed,
  currentStatus,
  status,
  variableName,
  batchSize,
  variables: batchVariables = [],
  elapsedSeconds,
  etaSeconds,
  onCancel,
  llmProvider = 'groq',
  language = 'R',
  dataset = 'ADSL'
}) => {
  const [variables, setVariables] = useState<VariableStatus[]>([]);
  const [currentBatchId, setCurrentBatchId] = useState<number>(0);

  // Calculate metrics
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = total - completed;
  const varsPerSecond = elapsedSeconds > 0 ? completed / elapsedSeconds : 0;

  // Determine current phase
  const getPhase = () => {
    if (completed === 0) return 'initializing';
    if (completed === total) return 'completing';
    if (status === 'batch_completed') return 'batch_processing';
    return 'processing';
  };

  const phase = getPhase();

  // Update variables based on status
  useEffect(() => {
    if (status === 'batch_completed' && batchSize && batchVariables.length > 0) {
      // Mark all variables in batch as completed
      setVariables(prev => {
        const updated = [...prev];
        batchVariables.forEach(varName => {
          const existing = updated.find(v => v.name === varName);
          if (existing) {
            existing.status = 'completed';
            existing.completedAt = Date.now();
          } else {
            updated.push({
              name: varName,
              status: 'completed',
              batchId: currentBatchId,
              completedAt: Date.now()
            });
          }
        });
        return updated;
      });
      setCurrentBatchId(prev => prev + 1);
    } else if (status === 'processing' && variableName) {
      // Mark variable as processing
      setVariables(prev => {
        const existing = prev.find(v => v.name === variableName);
        if (!existing) {
          return [...prev, { name: variableName, status: 'processing', batchId: currentBatchId }];
        }
        return prev.map(v => 
          v.name === variableName ? { ...v, status: 'processing' } : v
        );
      });
    }
  }, [status, variableName, batchSize, batchVariables, currentBatchId]);

  // Mark completed variables
  useEffect(() => {
    if (completed > 0) {
      setVariables(prev => {
        const completedVars = prev.filter(v => v.status === 'completed').length;
        const newCompleted = completed - completedVars;
        
        if (newCompleted > 0) {
          // Mark processing variables as completed
          const updated = prev.map(v => {
            if (v.status === 'processing') {
              return { ...v, status: 'completed' as const, completedAt: Date.now() };
            }
            return v;
          });
          
          // Add new completed variables if needed
          const additionalNeeded = newCompleted - updated.filter(v => v.status === 'completed').length;
          if (additionalNeeded > 0) {
            for (let i = 0; i < additionalNeeded; i++) {
              updated.push({
                name: `Variable ${completed - i}`,
                status: 'completed',
                completedAt: Date.now()
              });
            }
          }
          
          return updated;
        }
        return prev;
      });
    }
  }, [completed]);

  const formatDuration = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.round(seconds));
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${secs}s`;
  };

  const getProviderIcon = () => {
    const icons: Record<string, string> = {
      groq: '🚀',
      openai: '🧠',
      anthropic: '✨',
      google: '🌐',
      openrouter: '🌟'
    };
    return icons[llmProvider] || '🤖';
  };

  const processingVars = variables.filter(v => v.status === 'processing');
  const completedVars = variables.filter(v => v.status === 'completed');

  return (
    <Modal
      open={visible}
      onCancel={onCancel}
      footer={null}
      closable={true}
      maskClosable={false}
      width={700}
      className="code-generation-progress-modal"
      styles={{
        body: { padding: '24px' }
      }}
    >
      <div className="progress-modal-content">
        {/* Header */}
        <div className="progress-modal-header">
          <div className="header-left">
            <div className="header-icon-wrapper">
              <Zap size={24} className="header-icon" />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
                Generating AI Code
              </Title>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                Processing {total} variables using {getProviderIcon()} {llmProvider.toUpperCase()}
              </Text>
            </div>
          </div>
          <div className="header-stats">
            <div className="stat-item">
              <Text type="secondary" style={{ fontSize: '11px' }}>Progress</Text>
              <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>
                {progressPercent}%
              </Text>
            </div>
          </div>
        </div>

        <Divider style={{ margin: '20px 0' }} />

        {/* Main Progress Bar */}
        <div className="progress-section-main">
          <div className="progress-bar-wrapper">
            <Progress
              percent={progressPercent}
              status="active"
              strokeColor={{
                '0%': '#667eea',
                '100%': '#764ba2',
              }}
              trailColor="#f0f0f0"
              strokeWidth={10}
              showInfo={false}
            />
          </div>
          <div className="progress-stats-row">
            <div className="stat-box">
              <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                Completed
              </Text>
              <Text strong style={{ fontSize: '20px', color: '#52c41a' }}>
                {completed}
              </Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>of {total}</Text>
            </div>
            <div className="stat-box">
              <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                Remaining
              </Text>
              <Text strong style={{ fontSize: '20px', color: '#faad14' }}>
                {remaining}
              </Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>variables</Text>
            </div>
            <div className="stat-box">
              <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                Speed
              </Text>
              <Text strong style={{ fontSize: '20px', color: '#1890ff' }}>
                {varsPerSecond > 0 ? varsPerSecond.toFixed(1) : '0.0'}
              </Text>
              <Text type="secondary" style={{ fontSize: '11px' }}>vars/sec</Text>
            </div>
          </div>
        </div>

        {/* Current Status */}
        <div className="current-status-section">
          <div className="status-indicator">
            {phase === 'initializing' && <Spin indicator={<LoadingOutlined style={{ fontSize: 16 }} spin />} />}
            {phase === 'processing' && <ThunderboltOutlined style={{ fontSize: 16, color: '#1890ff' }} spin />}
            {phase === 'batch_processing' && <ThunderboltOutlined style={{ fontSize: 16, color: '#52c41a' }} />}
            {phase === 'completing' && <CheckCircleOutlined style={{ fontSize: 16, color: '#52c41a' }} />}
            <Text style={{ marginLeft: '8px', fontSize: '14px', fontWeight: 500 }}>
              {currentStatus || 'Initializing code generation...'}
            </Text>
          </div>
          
          {batchSize && status === 'batch_completed' && (
            <Tag color="success" icon={<ThunderboltOutlined />} style={{ marginTop: '8px' }}>
              Batch completed: {batchSize} variables
            </Tag>
          )}
        </div>

        {/* Detailed Metrics */}
        <div className="metrics-section">
          <div className="metrics-grid">
            <div className="metric-card metric-card--elapsed">
              <div className="metric-icon">
                <ClockCircleOutlined />
              </div>
              <div className="metric-content">
                <span className="metric-label">Elapsed Time</span>
                <span className="metric-value">{formatDuration(elapsedSeconds)}</span>
                <span className="metric-subtext">since generation started</span>
              </div>
            </div>
            
            <div className="metric-card metric-card--eta">
              <div className="metric-icon">
                <ClockCircleOutlined />
              </div>
              <div className="metric-content">
                <span className="metric-label">Estimated Time Remaining</span>
                <span className="metric-value">{formatDuration(etaSeconds)}</span>
                <span className="metric-subtext">based on current velocity</span>
              </div>
            </div>
            
            <div className="metric-card metric-card--dataset">
              <div className="metric-icon">
                <DatabaseOutlined />
              </div>
              <div className="metric-content">
                <span className="metric-label">Dataset</span>
                <span className="metric-value">{dataset}</span>
                <span className="metric-subtext">target ADaM domain</span>
              </div>
            </div>
            
            <div className="metric-card metric-card--language">
              <div className="metric-icon">
                <ApiOutlined />
              </div>
              <div className="metric-content">
                <span className="metric-label">Language</span>
                <span className="metric-value">{language}</span>
                <span className="metric-subtext">code output preference</span>
              </div>
            </div>
          </div>
        </div>

        {/* Variables Status */}
        {(processingVars.length > 0 || completedVars.length > 0) && (
          <>
            <Divider style={{ margin: '20px 0' }} />
            <div className="variables-status-section">
              <Text strong style={{ fontSize: '13px', marginBottom: '12px', display: 'block' }}>
                Variable Status
              </Text>
              
              <div className="variables-status-grid">
                {processingVars.length > 0 && (
                  <div className="status-group">
                    <div className="status-group-header">
                      <LoadingOutlined spin style={{ color: '#1890ff', marginRight: '6px' }} />
                      <Text strong style={{ fontSize: '12px', color: '#1890ff' }}>
                        Processing ({processingVars.length})
                      </Text>
                    </div>
                    <div className="variables-list">
                      {processingVars.slice(0, 5).map((v, idx) => (
                        <Tag key={idx} color="processing" style={{ marginBottom: '4px' }}>
                          {v.name}
                        </Tag>
                      ))}
                      {processingVars.length > 5 && (
                        <Tag color="processing">+{processingVars.length - 5} more</Tag>
                      )}
                    </div>
                  </div>
                )}
                
                {completedVars.length > 0 && (
                  <div className="status-group">
                    <div className="status-group-header">
                      <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '6px' }} />
                      <Text strong style={{ fontSize: '12px', color: '#52c41a' }}>
                        Completed ({completedVars.length})
                      </Text>
                    </div>
                    <div className="variables-list">
                      {completedVars.slice(-5).map((v, idx) => (
                        <Tag key={idx} color="success" style={{ marginBottom: '4px' }}>
                          {v.name}
                        </Tag>
                      ))}
                      {completedVars.length > 5 && (
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          ... and {completedVars.length - 5} more
                        </Text>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Backend Status Info */}
        <div className="backend-info-section">
          <Divider style={{ margin: '20px 0' }} />
          <div className="backend-info">
            <Text type="secondary" style={{ fontSize: '11px' }}>
              <DatabaseOutlined style={{ marginRight: '4px' }} />
              Processing in batches of ~15 variables • 
              <ApiOutlined style={{ marginLeft: '6px', marginRight: '4px' }} />
              Up to 20 concurrent requests • 
              <ThunderboltOutlined style={{ marginLeft: '6px', marginRight: '4px' }} />
              Optimized for speed
            </Text>
          </div>
        </div>

        {/* Cancel Button */}
        <div className="modal-footer-actions">
          <button
            onClick={onCancel}
            className="cancel-button"
          >
            <X size={14} style={{ marginRight: '6px' }} />
            Cancel Generation
          </button>
        </div>
      </div>
    </Modal>
  );
};
