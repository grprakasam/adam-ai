import { Alert, Button } from 'antd';
import { useRecoveryStore } from '../store/recoveryStore';
import './RecoverySuggestions.css';

export const RecoverySuggestions = () => {
  const suggestions = useRecoveryStore((state) => state.suggestions);
  const dismissSuggestion = useRecoveryStore((state) => state.dismissSuggestion);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="recovery-suggestions" role="region" aria-label="Recovery suggestions">
      {suggestions.map((suggestion) => (
        <Alert
          key={suggestion.id}
          type="warning"
          showIcon
          message={suggestion.title}
          description={
            <div>
              <p>{suggestion.message}</p>
              {suggestion.suggestion && (
                <p className="suggestion-hint">
                  Suggested recovery: {suggestion.suggestion}
                </p>
              )}
            </div>
          }
          action={
            <Button size="small" onClick={() => dismissSuggestion(suggestion.id)}>
              Dismiss
            </Button>
          }
        />
      ))}
    </div>
  );
};

export default RecoverySuggestions;
