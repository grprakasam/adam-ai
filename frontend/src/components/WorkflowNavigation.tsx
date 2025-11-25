import React from 'react';
import { Button, Tooltip } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import './WorkflowNavigation.css';

export type WorkflowStep = 'pair' | 'review' | 'consolidated';

interface WorkflowNavigationProps {
  currentStep: WorkflowStep;
  onNavigate: (step: WorkflowStep) => void;
}

const WORKFLOW_STEPS: WorkflowStep[] = ['pair', 'review', 'consolidated'];

const STEP_LABELS: Record<WorkflowStep, string> = {
  pair: 'Pair Programming',
  review: 'Code Review',
  consolidated: 'Consolidated Code',
};

export const WorkflowNavigation: React.FC<WorkflowNavigationProps> = ({ currentStep, onNavigate }) => {
  const currentIndex = WORKFLOW_STEPS.indexOf(currentStep);
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < WORKFLOW_STEPS.length - 1;

  const handleBack = () => {
    if (canGoBack) {
      onNavigate(WORKFLOW_STEPS[currentIndex - 1]);
    }
  };

  const handleForward = () => {
    if (canGoForward) {
      onNavigate(WORKFLOW_STEPS[currentIndex + 1]);
    }
  };

  return (
    <div className="workflow-navigation">
      <Tooltip title={canGoBack ? `Back to ${STEP_LABELS[WORKFLOW_STEPS[currentIndex - 1]]}` : 'No previous step'}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
          disabled={!canGoBack}
          size="small"
          className="nav-button nav-button-back"
        >
          Back
        </Button>
      </Tooltip>

      <div className="workflow-status">
        <div className="workflow-progress">
          {WORKFLOW_STEPS.map((step, index) => (
            <div key={step} className={`workflow-dot ${step === currentStep ? 'active' : ''} ${index < currentIndex ? 'completed' : ''}`} />
          ))}
        </div>
        <span className="workflow-text">
          {currentIndex + 1} of {WORKFLOW_STEPS.length}: {STEP_LABELS[currentStep]}
        </span>
      </div>

      <Tooltip title={canGoForward ? `Forward to ${STEP_LABELS[WORKFLOW_STEPS[currentIndex + 1]]}` : 'No next step'}>
        <Button
          icon={<ArrowRightOutlined />}
          onClick={handleForward}
          disabled={!canGoForward}
          size="small"
          className="nav-button nav-button-forward"
        >
          Forward
        </Button>
      </Tooltip>
    </div>
  );
};
