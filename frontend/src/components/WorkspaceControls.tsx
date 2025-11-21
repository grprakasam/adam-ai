import React from 'react';
import { Button } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/projectStore';
import './WorkspaceControls.css';

interface WorkspaceControlsProps {
  onSwitchProject?: () => void;
}

export const WorkspaceControls: React.FC<WorkspaceControlsProps> = ({ onSwitchProject }) => {
  const { programmingLanguage, setProgrammingLanguage } = useProjectStore();

  return (
    <div className="workspace-controls">
      {onSwitchProject && (
        <Button
          icon={<SwapOutlined />}
          onClick={onSwitchProject}
          className="switch-project-button"
          size="middle"
        >
          Switch Project
        </Button>
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

