import { create } from 'zustand';

export interface RecoverySuggestion {
  id: string;
  title: string;
  message: string;
  suggestion?: string;
  timestamp: string;
}

interface RecoveryStore {
  suggestions: RecoverySuggestion[];
  addSuggestion: (suggestion: Omit<RecoverySuggestion, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => void;
  dismissSuggestion: (id: string) => void;
  clear: () => void;
}

const makeId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `rec-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const useRecoveryStore = create<RecoveryStore>((set) => ({
  suggestions: [],
  addSuggestion: (suggestion) =>
    set((state) => {
      const entry: RecoverySuggestion = {
        id: suggestion.id || makeId(),
        title: suggestion.title,
        message: suggestion.message,
        suggestion: suggestion.suggestion,
        timestamp: suggestion.timestamp || new Date().toISOString(),
      };
      const next = [entry, ...state.suggestions].slice(0, 4);
      return { suggestions: next };
    }),
  dismissSuggestion: (id) =>
    set((state) => ({
      suggestions: state.suggestions.filter((item) => item.id !== id),
    })),
  clear: () => set({ suggestions: [] }),
}));
