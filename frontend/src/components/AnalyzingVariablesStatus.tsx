import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Progress, Space, Typography, Spin } from 'antd';

type Props = {
  fileName?: string;
  totalVars?: number;
  parsedVars?: number;
  categoryCount?: number;
  currentStep: number; // 1..6
  totalSteps?: number; // default 6
  adamVersion?: string;
  meddraVersion?: string;
  startTime?: number; // Date.now()
  cancellable?: boolean;
  onCancel?: () => void;
  onForceReset?: () => void;
};

const LONG_WAIT_MS = 45_000; // Show warning after 45 seconds
const VERY_LONG_WAIT_MS = 90_000; // Show force reset after 90 seconds

const STEP_LABELS = [
  'Loading file…',
  'Detecting dataset and standards…',
  'Parsing “Variable” column and metadata…',
  'Applying ADaM rules and naming checks…',
  'Grouping variables into categories…',
  'Finalizing your workspace…',
];

export default function AnalyzingVariablesStatus({
  fileName,
  totalVars,
  parsedVars,
  categoryCount,
  currentStep,
  totalSteps = 6,
  adamVersion,
  meddraVersion,
  startTime,
  cancellable,
  onCancel,
  onForceReset,
}: Props) {
  const startedAt = useRef(startTime ?? Date.now());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const elapsed = now - startedAt.current;
  const pct = Math.max(5, Math.min(95, Math.round(((currentStep - 1) / totalSteps) * 100)));

  const eta = useMemo(() => {
    if (currentStep <= 1) return undefined;
    const perStep = elapsed / Math.max(1, currentStep - 1);
    const stepsLeft = Math.max(0, totalSteps - (currentStep - 1));
    return Math.round((perStep * stepsLeft) / 1000);
  }, [elapsed, currentStep, totalSteps]);

  const stepLabel = STEP_LABELS[currentStep - 1] || 'Working…';

  const takingLong = elapsed >= LONG_WAIT_MS && elapsed < VERY_LONG_WAIT_MS;
  const veryLong = elapsed >= VERY_LONG_WAIT_MS;

  return (
    <Card role="status" aria-live="polite" aria-busy="true" bordered={false} style={{ textAlign: 'center' }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Spin size="large" tip="Analyzing your specification…" />
        <Typography.Text>
          We’re reading your Excel, mapping variables to ADaM rules, and organizing them by category for review.
          Typical time: 20–45 seconds; large files may take 2–3 minutes.
        </Typography.Text>

        <Progress percent={pct} status="active" format={() => `Step ${currentStep}/${totalSteps}`} />

        <Typography.Text type="secondary">
          {currentStep}/{totalSteps} {stepLabel} {fileName ? `(${fileName})` : ''}
        </Typography.Text>

        <Typography.Text type="secondary">
          {typeof parsedVars === 'number' && typeof totalVars === 'number'
            ? `${parsedVars}/${totalVars} variables detected`
            : 'Detecting variables…'}
          {typeof categoryCount === 'number' ? ` • ${categoryCount} categories` : ''}
          {adamVersion ? ` • ADaM IG ${adamVersion}` : ''}
          {meddraVersion ? ` • MedDRA ${meddraVersion}` : ''}
        </Typography.Text>

        {takingLong && (
          <Typography.Text>
            Still working… this may take longer for large files or complex mappings.
            {eta ? ` ~${eta}s remaining.` : ''}
          </Typography.Text>
        )}
        {veryLong && (
          <Typography.Text type="warning" style={{ color: '#faad14', fontWeight: 500 }}>
            This is taking longer than expected. The request may have stalled. {eta ? `~${eta}s remaining.` : ''}
          </Typography.Text>
        )}

        {cancellable && (
          <div style={{ marginTop: 8 }}>
            <a role="button" onClick={onCancel} style={{ marginRight: 16, cursor: 'pointer', color: '#1890ff' }}>
              Cancel and retry
            </a>
            {(veryLong || elapsed >= 60000) && onForceReset && (
              <a 
                role="button" 
                onClick={onForceReset} 
                style={{ 
                  color: '#ff4d4f', 
                  cursor: 'pointer',
                  fontWeight: 500,
                  textDecoration: 'underline'
                }}
              >
                Force Reset (Stuck?)
              </a>
            )}
          </div>
        )}
      </Space>
    </Card>
  );
}

