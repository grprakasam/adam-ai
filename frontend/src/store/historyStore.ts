import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import type { ProjectConfiguration, StudyMetadata } from '../types';
import type { ProjectStore, Rule, SpecificationFile } from './projectStore';
import { useProjectStore } from './projectStore';

const MAX_HISTORY_ENTRIES = 20;

type WorkspaceSnapshot = {
  projectConfig: ProjectConfiguration;
  studyMetadata: StudyMetadata;
  specificationFile: SpecificationFile | null;
  rules: Rule[];
  timestamp: string;
};

type SnapshotCore = Omit<WorkspaceSnapshot, 'timestamp'>;

interface HistoryStore {
  history: WorkspaceSnapshot[];
  future: WorkspaceSnapshot[];
  canUndo: boolean;
  canRedo: boolean;
  record: (snapshot: WorkspaceSnapshot) => void;
  undo: () => boolean;
  redo: () => boolean;
  clear: () => void;
}

const deepClone = <T>(value: T): T => {
  const structured = (globalThis as any)?.structuredClone;
  if (typeof structured === 'function') {
    return structured(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const snapshotCore = (state: ProjectStore): SnapshotCore => ({
  projectConfig: state.projectConfig,
  studyMetadata: state.studyMetadata,
  specificationFile: state.specificationFile,
  rules: state.rules,
});

const buildSnapshot = (state: ProjectStore): WorkspaceSnapshot => ({
  ...deepClone(snapshotCore(state)),
  timestamp: new Date().toISOString(),
});

let suppressRecording = false;

const applySnapshot = (snapshot: WorkspaceSnapshot) => {
  suppressRecording = true;
  useProjectStore.setState((state) => ({
    ...state,
    projectConfig: deepClone(snapshot.projectConfig),
    studyMetadata: deepClone(snapshot.studyMetadata),
    specificationFile: snapshot.specificationFile ? { ...snapshot.specificationFile } : null,
    rules: snapshot.rules.map((rule) => ({ ...rule })),
  }));
};

export const useWorkspaceHistory = create<HistoryStore>((set, get) => ({
  history: [],
  future: [],
  canUndo: false,
  canRedo: false,
  record: (snapshot) =>
    set((state) => {
      const entry = deepClone(snapshot);
      const nextHistory = [...state.history, entry];
      if (nextHistory.length > MAX_HISTORY_ENTRIES) {
        nextHistory.shift();
      }
      return {
        history: nextHistory,
        future: [],
        canUndo: nextHistory.length > 0,
        canRedo: false,
      };
    }),
  undo: () => {
    const { history } = get();
    if (history.length === 0) {
      return false;
    }

    const previous = history[history.length - 1];
    const currentSnapshot = buildSnapshot(useProjectStore.getState());
    applySnapshot(previous);

    set((state) => {
      const nextHistory = state.history.slice(0, -1);
      return {
        history: nextHistory,
        future: [...state.future, currentSnapshot],
        canUndo: nextHistory.length > 0,
        canRedo: true,
      };
    });

    return true;
  },
  redo: () => {
    const { future } = get();
    if (future.length === 0) {
      return false;
    }

    const next = future[future.length - 1];
    const currentSnapshot = buildSnapshot(useProjectStore.getState());
    applySnapshot(next);

    set((state) => {
      const remainingFuture = state.future.slice(0, -1);
      return {
        future: remainingFuture,
        history: [...state.history, currentSnapshot],
        canUndo: true,
        canRedo: remainingFuture.length > 0,
      };
    });

    return true;
  },
  clear: () =>
    set({
      history: [],
      future: [],
      canUndo: false,
      canRedo: false,
    }),
}));

const coreSnapshotSelector = (state: ProjectStore): SnapshotCore => snapshotCore(state);

useProjectStore.subscribe(
  coreSnapshotSelector,
  (_current, previous) => {
    if (suppressRecording) {
      suppressRecording = false;
      return;
    }
    if (!previous) {
      return;
    }
    useWorkspaceHistory.getState().record({
      ...deepClone(previous),
      timestamp: new Date().toISOString(),
    });
  },
  { equalityFn: shallow }
);
