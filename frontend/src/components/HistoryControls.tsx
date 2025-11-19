import { Button, Tooltip } from 'antd';
import { UndoOutlined, RedoOutlined } from '@ant-design/icons';
import { useWorkspaceHistory } from '../store/historyStore';
import './HistoryControls.css';

export const HistoryControls = () => {
  const canUndo = useWorkspaceHistory((state) => state.canUndo);
  const canRedo = useWorkspaceHistory((state) => state.canRedo);
  const undo = useWorkspaceHistory((state) => state.undo);
  const redo = useWorkspaceHistory((state) => state.redo);

  return (
    <div className="history-controls" role="group" aria-label="Workspace history controls">
      <Tooltip title="Undo last change (Ctrl+Z)">
        <Button
          icon={<UndoOutlined />}
          size="small"
          disabled={!canUndo}
          onClick={() => undo()}
        >
          Undo
        </Button>
      </Tooltip>
      <Tooltip title="Redo change (Ctrl+Shift+Z)">
        <Button
          icon={<RedoOutlined />}
          size="small"
          disabled={!canRedo}
          onClick={() => redo()}
        >
          Redo
        </Button>
      </Tooltip>
    </div>
  );
};

export default HistoryControls;
