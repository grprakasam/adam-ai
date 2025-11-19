import { useState, useEffect, useCallback } from 'react';
import { useProjectStore } from '../store/projectStore';

type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const STORAGE_KEY = 'adam-ai-autosave-draft';

export const useWorkspaceAutosave = () => {
  const projectConfig = useProjectStore((state) => state.projectConfig);
  const studyMetadata = useProjectStore((state) => state.studyMetadata);
  const specificationFile = useProjectStore((state) => state.specificationFile);
  const rules = useProjectStore((state) => state.rules);

  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const draft = localStorage.getItem(STORAGE_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        setHasDraft(true);
        if (parsed.timestamp) {
          setLastSavedAt(parsed.timestamp);
        }
      }
    } catch (error) {
      console.error('Unable to read autosave draft', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setStatus('saving');
    const payload = {
      projectConfig,
      studyMetadata,
      specificationFile,
      rules,
      timestamp: new Date().toISOString(),
    };

    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        setHasDraft(true);
        setLastSavedAt(payload.timestamp);
        setStatus('saved');
      } catch (error) {
        console.error('Autosave failed', error);
        setStatus('error');
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [projectConfig, studyMetadata, specificationFile, rules]);

  const restoreDraft = useCallback(() => {
    if (typeof window === 'undefined') return false;
    try {
      const draft = localStorage.getItem(STORAGE_KEY);
      if (!draft) return false;
      const parsed = JSON.parse(draft);
      useProjectStore.setState((state) => ({
        ...state,
        projectConfig: parsed.projectConfig ?? state.projectConfig,
        studyMetadata: parsed.studyMetadata ?? state.studyMetadata,
        specificationFile: parsed.specificationFile ?? state.specificationFile,
        rules: parsed.rules ?? state.rules,
      }));
      setStatus('saved');
      setLastSavedAt(parsed.timestamp ?? new Date().toISOString());
      return true;
    } catch (error) {
      console.error('Unable to restore autosave draft', error);
      setStatus('error');
      return false;
    }
  }, []);

  return {
    status,
    lastSavedAt,
    hasDraft,
    restoreDraft,
  };
};
