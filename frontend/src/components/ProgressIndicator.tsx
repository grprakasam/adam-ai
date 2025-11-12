/**
 * Progress Indicator Component
 * Visual indicators for long-running operations
 */

import React from 'react';
import { Progress, Modal, Button } from 'antd';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { ProgressState } from '../hooks/useProgress';

interface ProgressIndicatorProps {
  progress: ProgressState;
  title?: string;
  showPercentage?: boolean;
  status?: 'active' | 'success' | 'exception' | 'normal';
}

/**
 * Inline Progress Bar
 */
export const ProgressBar: React.FC<ProgressIndicatorProps> = ({
  progress,
  showPercentage = true,
  status,
}) => {
  const getStatus = () => {
    if (status) return status;
    if (progress.isCancelled) return 'exception';
    if (progress.isComplete) return 'success';
    return 'active';
  };

  return (
    <div style={{ width: '100%' }}>
      <Progress
        percent={progress.percentage}
        status={getStatus()}
        showInfo={showPercentage}
      />
      {progress.message && (
        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
          {progress.message}
        </div>
      )}
    </div>
  );
};

/**
 * Progress Circle
 */
export const ProgressCircle: React.FC<ProgressIndicatorProps> = ({
  progress,
  showPercentage = true,
  status,
}) => {
  const getStatus = () => {
    if (status) return status;
    if (progress.isCancelled) return 'exception';
    if (progress.isComplete) return 'success';
    return 'normal';
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <Progress
        type="circle"
        percent={progress.percentage}
        status={getStatus()}
        format={showPercentage ? undefined : () => ''}
      />
      {progress.message && (
        <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          {progress.message}
        </div>
      )}
    </div>
  );
};

/**
 * Progress Modal Dialog
 * Full-screen modal for important long-running operations
 */
interface ProgressModalProps {
  visible: boolean;
  progress: ProgressState;
  title: string;
  description?: string;
  onCancel?: () => void;
  cancelable?: boolean;
}

export const ProgressModal: React.FC<ProgressModalProps> = ({
  visible,
  progress,
  title,
  description,
  onCancel,
  cancelable = false,
}) => {
  return (
    <Modal
      open={visible}
      title={title}
      footer={
        cancelable && !progress.isComplete
          ? [
              <Button key="cancel" onClick={onCancel} danger>
                Cancel
              </Button>,
            ]
          : null
      }
      closable={false}
      maskClosable={false}
      centered
    >
      <div style={{ padding: '20px 0' }}>
        {description && (
          <p style={{ marginBottom: '20px', color: '#666' }}>{description}</p>
        )}

        <ProgressCircle progress={progress} />

        {progress.isComplete && (
          <div
            style={{
              textAlign: 'center',
              marginTop: '20px',
              color: '#52c41a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle size={20} />
            <span>Operation completed successfully!</span>
          </div>
        )}

        {progress.isCancelled && (
          <div
            style={{
              textAlign: 'center',
              marginTop: '20px',
              color: '#ff4d4f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <XCircle size={20} />
            <span>Operation cancelled</span>
          </div>
        )}

        {!progress.isComplete && !progress.isCancelled && (
          <div
            style={{
              textAlign: 'center',
              marginTop: '20px',
              color: '#1890ff',
            }}
          >
            {progress.message || 'Processing...'}
          </div>
        )}
      </div>
    </Modal>
  );
};

/**
 * Inline Progress with Stats
 * Shows progress with detailed statistics
 */
interface ProgressWithStatsProps {
  progress: ProgressState;
  successCount?: number;
  errorCount?: number;
  title?: string;
}

export const ProgressWithStats: React.FC<ProgressWithStatsProps> = ({
  progress,
  successCount = 0,
  errorCount = 0,
  title,
}) => {
  return (
    <div style={{ padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
      {title && (
        <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>
          {title}
        </h4>
      )}

      <ProgressBar progress={progress} />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '12px',
          fontSize: '12px',
        }}
      >
        <div>
          <span style={{ color: '#666' }}>Progress: </span>
          <span style={{ fontWeight: 600 }}>
            {progress.current} / {progress.total}
          </span>
        </div>

        {(successCount > 0 || errorCount > 0) && (
          <div style={{ display: 'flex', gap: '16px' }}>
            {successCount > 0 && (
              <div style={{ color: '#52c41a' }}>
                <CheckCircle size={14} style={{ marginRight: '4px' }} />
                {successCount} succeeded
              </div>
            )}
            {errorCount > 0 && (
              <div style={{ color: '#ff4d4f' }}>
                <XCircle size={14} style={{ marginRight: '4px' }} />
                {errorCount} failed
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Spinner with Progress Message
 * Simple loading spinner with custom message
 */
interface SpinnerWithMessageProps {
  message?: string;
  size?: number;
}

export const SpinnerWithMessage: React.FC<SpinnerWithMessageProps> = ({
  message = 'Loading...',
  size = 24,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
      }}
    >
      <Loader2
        size={size}
        style={{
          animation: 'spin 1s linear infinite',
          color: '#1890ff',
        }}
      />
      <span style={{ color: '#666', fontSize: '14px' }}>{message}</span>
      <style>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

export default {
  ProgressBar,
  ProgressCircle,
  ProgressModal,
  ProgressWithStats,
  SpinnerWithMessage,
};
