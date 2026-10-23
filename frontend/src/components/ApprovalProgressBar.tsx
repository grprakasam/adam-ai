import React from 'react';
import { useApprovalProgress } from '../hooks/useApprovalProgress';
import './ApprovalProgressBar.css';

/**
 * Persistent progress bar displayed at the bottom of the page
 * Shows approval progress and threshold status
 */
export const ApprovalProgressBar: React.FC = () => {
  const { totalVariables } = 
    useApprovalProgress();

  // Don't show if no variables
  if (totalVariables === 0) {
    return null;
  }

  return null;
};
