import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  onToggleLeftPanel?: () => void;
  onFocusMainContent?: () => void;
  onOpenHelpCenter?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const useKeyboardShortcuts = (handlers: ShortcutHandlers) => {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const currentHandlers = handlersRef.current;

      // Undo / Redo
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        if (event.key.toLowerCase() === 'z') {
          event.preventDefault();
          if (event.shiftKey) {
            handlersRef.current.onRedo?.();
          } else {
            handlersRef.current.onUndo?.();
          }
          return;
        }
      }

      // Toggle configuration panel
      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        if (event.key === '[' || event.key === '\\') {
          if (currentHandlers.onToggleLeftPanel) {
            event.preventDefault();
            currentHandlers.onToggleLeftPanel();
          }
          return;
        }

        if (event.key === '1' && currentHandlers.onFocusMainContent) {
          event.preventDefault();
          currentHandlers.onFocusMainContent();
          return;
        }
      }

      // Open help center (Shift + /)
      if ((event.key === '?' || event.key === '/') && event.shiftKey) {
        if (currentHandlers.onOpenHelpCenter) {
          event.preventDefault();
          currentHandlers.onOpenHelpCenter();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
