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
        {/* Logo */}
        <img 
          src="/CompanyLogo.png" 
          alt="Company Logo" 
          className="progress-bar-logo"
        />
      </div>
    </div>
  );
};
