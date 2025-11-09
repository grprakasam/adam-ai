import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import './ProgressIndicator.css';

interface ProgressIndicatorProps {
  percentage: number;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ percentage }) => {
  const isComplete = percentage === 100;
  const isPartial = percentage > 0 && percentage < 100;

  return (
    <div className="progress-indicator">
      <div className="progress-header">
        <div className="progress-label">
          {isComplete && (
            <>
              <CheckCircle2 size={16} className="progress-icon success" />
              <span>Configuration Complete</span>
            </>
          )}
          {isPartial && (
            <>
              <AlertCircle size={16} className="progress-icon warning" />
              <span>Configuration In Progress</span>
            </>
          )}
          {percentage === 0 && (
            <>
              <AlertCircle size={16} className="progress-icon neutral" />
              <span>Start Configuration</span>
            </>
          )}
        </div>
        <span className={`progress-percentage ${isComplete ? 'complete' : ''}`}>
          {percentage}%
        </span>
      </div>
      <div className="progress">
        <div
          className="progress-bar"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
};

export default ProgressIndicator;
