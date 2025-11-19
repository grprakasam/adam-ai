import { Button, Tooltip, message } from 'antd';
import { CloudSyncOutlined, CheckCircleOutlined, WarningOutlined, HistoryOutlined } from '@ant-design/icons';
import { useWorkspaceAutosave } from '../hooks/useWorkspaceAutosave';
import './AutoSaveIndicator.css';

const formatTimestamp = (isoString: string) => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const AutoSaveIndicator = () => {
  const { status, lastSavedAt, hasDraft, restoreDraft } = useWorkspaceAutosave();

  const handleRestore = async () => {
    const restored = restoreDraft();
    if (restored) {
      message.success('Draft restored from auto-save');
    } else {
      message.warning('No draft available to restore');
    }
  };

  const renderIcon = () => {
    switch (status) {
      case 'saving':
        return <CloudSyncOutlined spin aria-hidden="true" />;
      case 'error':
        return <WarningOutlined aria-hidden="true" />;
      case 'saved':
        return <CheckCircleOutlined aria-hidden="true" />;
      default:
        return <HistoryOutlined aria-hidden="true" />;
    }
  };

  const labelMap: Record<string, string> = {
    idle: 'Auto-save is idle',
    saving: 'Saving draft…',
    saved: 'All changes saved',
    error: 'Auto-save failed',
  };

  return (
    <div className={`auto-save-indicator status-${status}`} role="status" aria-live="polite">
      <span className="indicator-state">
        {renderIcon()}
        {labelMap[status]}
        {lastSavedAt && status !== 'error' && (
          <span className="timestamp" aria-label={`Last saved at ${formatTimestamp(lastSavedAt)}`}>
            • {formatTimestamp(lastSavedAt)}
          </span>
        )}
      </span>

      {status === 'error' && (
        <span className="indicator-hint">
          Check your connection or use Restore Draft to recover your last copy.
        </span>
      )}

      {hasDraft && (
        <Tooltip title="Restore the last auto-saved configuration">
          <Button size="small" onClick={handleRestore}>
            Restore Draft
          </Button>
        </Tooltip>
      )}
    </div>
  );
};

export default AutoSaveIndicator;
