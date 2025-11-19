import React from 'react';
import { Progress, Tooltip } from 'antd';
import { Info } from 'lucide-react';
import { useApprovalProgress } from '../hooks/useApprovalProgress';
import { VisuallyHidden } from './a11y/VisuallyHidden';
import './ApprovalProgressBar.css';

/**
 * Persistent progress bar displayed at the bottom of the page
 * Shows approval progress and threshold status
 */
export const ApprovalProgressBar: React.FC = () => {
  const { totalVariables, approvedVariables, percentage, isReadyForGeneration } = 
    useApprovalProgress();

  // Don't show if no variables
  if (totalVariables === 0) {
    return null;
  }

  return (
    <div className="approval-progress-bar-container" role="status" aria-live="polite" aria-atomic="true">
      <div className="approval-progress-content">
        {/* Progress Bar */}
        <div className="progress-section">
          <Progress
            percent={percentage}
            strokeColor={
              isReadyForGeneration
                ? { '0%': '#10B981', '100%': '#059669' }
                : { '0%': '#FFA500', '100%': '#FF8C00' }
            }
            format={() => `${percentage}%`}
            style={{ width: '300px' }}
            size="default"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Variable approval progress"
          />
          <VisuallyHidden>
            {isReadyForGeneration
              ? 'Validation threshold reached. You can generate consolidated code.'
              : `Validation progress ${percentage} percent. Approve at least 80 percent of variables.`}
          </VisuallyHidden>
        </div>

        {/* Status Text */}
        <div className="status-text">
          <span className="approved-count">
            {approvedVariables} of {totalVariables} variables approved
          </span>
          {isReadyForGeneration && (
            <span className="ready-badge">✓ Ready for generation</span>
          )}
          {!isReadyForGeneration && percentage > 0 && (
            <span className="pending-badge">
              {80 - percentage}% more needed
            </span>
          )}
        </div>

        {/* Info Tooltip */}
        <Tooltip
          title="Approve at least 80% of variables to enable final code generation"
          placement="top"
        >
          <Info size={20} className="info-icon" aria-hidden="true" focusable="false" />
        </Tooltip>
      </div>
    </div>
  );
};
