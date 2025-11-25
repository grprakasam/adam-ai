import React, { useState } from 'react';
import { Button, Modal } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/projectStore';
import './WorkspaceControls.css';

interface WorkspaceControlsProps {
  onSwitchProject?: () => void;
}

export const WorkspaceControls: React.FC<WorkspaceControlsProps> = ({ onSwitchProject }) => {
  const { programmingLanguage, setProgrammingLanguage, codeReviewSession } = useProjectStore();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleSwitchProjectClick = () => {
    // Check if there's an active code review session
    if (codeReviewSession && (codeReviewSession.status === 'IN_REVIEW' || codeReviewSession.status === 'CHANGES_REQUESTED')) {
      setShowConfirmDialog(true);
    } else {
      // No active review, proceed with switch
      onSwitchProject?.();
    }
  };

  const handleConfirmSwitch = () => {
    setShowConfirmDialog(false);
    onSwitchProject?.();
  };

  return (
    <div className="workspace-controls">
      {onSwitchProject && (
        <>
          <Button
            icon={<SwapOutlined />}
            onClick={handleSwitchProjectClick}
            className="switch-project-button"
            size="middle"
          >
            Switch Project
          </Button>
          <Modal
            title="Active Code Review"
            open={showConfirmDialog}
            onOk={handleConfirmSwitch}
            onCancel={() => setShowConfirmDialog(false)}
            okText="Discard Review"
            cancelText="Continue Review"
            okButtonProps={{ danger: true }}
          >
            <p>You have an active code review session in progress.</p>
            <p>Switching projects will discard your review progress.</p>
            <p><strong>Do you want to continue?</strong></p>
          </Modal>
        </>
      )}
      <div className="language-selection">
        <span className="language-label">Language:</span>
        <div className="language-buttons">
          <Button
            type={programmingLanguage === 'R' ? 'primary' : 'default'}
            onClick={() => setProgrammingLanguage('R')}
            className={`language-btn ${programmingLanguage === 'R' ? 'active' : ''}`}
            size="middle"
          >
            R
          </Button>
          <Button
            type={programmingLanguage === 'SAS' ? 'primary' : 'default'}
            onClick={() => setProgrammingLanguage('SAS')}
            className={`language-btn ${programmingLanguage === 'SAS' ? 'active' : ''}`}
            size="middle"
          >
            SAS
          </Button>
        </div>
      </div>
    </div>
  );
};

