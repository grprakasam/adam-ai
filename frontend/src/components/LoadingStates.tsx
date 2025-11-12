/**
 * Loading State Components
 * Reusable loading indicators and skeleton screens
 */

import React from 'react';
import { Spin, Skeleton } from 'antd';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'small' | 'default' | 'large';
  tip?: string;
  fullscreen?: boolean;
}

/**
 * Loading Spinner Component
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'default',
  tip,
  fullscreen = false
}) => {
  const spinner = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '12px'
    }}>
      <Spin size={size} />
      {tip && <div style={{ color: '#666', fontSize: '14px' }}>{tip}</div>}
    </div>
  );

  if (fullscreen) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255, 255, 255, 0.9)',
        zIndex: 9999
      }}>
        {spinner}
      </div>
    );
  }

  return (
    <div style={{
      padding: '40px',
      textAlign: 'center'
    }}>
      {spinner}
    </div>
  );
};

interface RotatingIconProps {
  size?: number;
  tip?: string;
}

/**
 * Rotating Icon Loading Indicator
 */
export const RotatingIconLoader: React.FC<RotatingIconProps> = ({
  size = 24,
  tip
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px'
    }}>
      <Loader2
        size={size}
        style={{
          animation: 'spin 1s linear infinite'
        }}
        color="#1890ff"
      />
      {tip && <div style={{ color: '#666', fontSize: '13px' }}>{tip}</div>}
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

/**
 * Table Skeleton Loader
 */
export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton
          key={index}
          active
          paragraph={{ rows: 1 }}
          style={{ marginBottom: '12px' }}
        />
      ))}
    </div>
  );
};

/**
 * Card Skeleton Loader
 */
export const CardSkeleton: React.FC = () => {
  return (
    <div style={{
      padding: '20px',
      background: 'white',
      borderRadius: '8px',
      border: '1px solid #f0f0f0'
    }}>
      <Skeleton active paragraph={{ rows: 4 }} />
    </div>
  );
};

/**
 * Form Skeleton Loader
 */
export const FormSkeleton: React.FC<{ fields?: number }> = ({ fields = 4 }) => {
  return (
    <div style={{ padding: '20px' }}>
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} style={{ marginBottom: '24px' }}>
          <Skeleton.Input active style={{ width: '150px', marginBottom: '8px' }} />
          <Skeleton.Input active block style={{ height: '32px' }} />
        </div>
      ))}
    </div>
  );
};

/**
 * Text Block Skeleton Loader
 */
export const TextBlockSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => {
  return (
    <div>
      <Skeleton active paragraph={{ rows: lines }} title={false} />
    </div>
  );
};

/**
 * Loading Overlay Component
 */
interface LoadingOverlayProps {
  loading: boolean;
  tip?: string;
  children: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  loading,
  tip,
  children
}) => {
  return (
    <Spin spinning={loading} tip={tip} size="large">
      {children}
    </Spin>
  );
};

export default {
  LoadingSpinner,
  RotatingIconLoader,
  TableSkeleton,
  CardSkeleton,
  FormSkeleton,
  TextBlockSkeleton,
  LoadingOverlay
};
