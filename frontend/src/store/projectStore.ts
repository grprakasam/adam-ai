import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProjectConfiguration, StudyMetadata, GenerationOptions } from '../types';

export interface Rule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  predefined?: boolean;
}

interface ProjectStore {
  // Project Configuration
  projectConfig: ProjectConfiguration;
  setProjectConfig: (config: Partial<ProjectConfiguration>) => void;

  // Study Metadata
  studyMetadata: StudyMetadata;
  setStudyMetadata: (metadata: Partial<StudyMetadata>) => void;

  // Standards Configuration
  sdtmVersion: string;
  adamIgVersion: string;
  medraVersion: string;
  setStandards: (standards: { sdtmVersion?: string; adamIgVersion?: string; medraVersion?: string }) => void;

  // Data Selection
  selectedDatasets: string[];
  selectedVariables: string[];
  setDatasets: (datasets: string[]) => void;
  setVariables: (variables: string[]) => void;

  // Rules
  rules: Rule[];
  addRule: (rule: Rule) => void;
  updateRule: (id: string, updates: Partial<Rule>) => void;
  deleteRule: (id: string) => void;

  // Generation Options
  generationOptions: GenerationOptions;
  setGenerationOptions: (options: Partial<GenerationOptions>) => void;

  // UI State
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;

  // Computed values
  getCompletionPercentage: () => number;
  getTabStatus: (tabKey: string) => 'complete' | 'incomplete' | 'warning' | 'not-started';

  // Reset
  reset: () => void;
}

const initialState = {
  projectConfig: {
    studyId: '',
    protocolNumber: '',
    sponsor: '',
    therapeuticArea: '',
    studyPhase: '',
    programmingLanguage: 'R',
    sdtmVersion: 'SDTM v2.0',
    adamIgVersion: 'ADaM IG v1.3',
    medraVersion: 'MedDRA v27.0',
  },
  studyMetadata: {
    studyId: '',
    protocolNumber: '',
    therapeuticArea: '',
    studyPhase: '',
  },
  sdtmVersion: 'SDTM v2.0',
  adamIgVersion: 'ADaM IG v1.3',
  medraVersion: 'MedDRA v27.0',
  selectedDatasets: [],
  selectedVariables: [],
  rules: [],
  generationOptions: {
    includeComments: 'comprehensive' as const,
    codeStyle: 'standard' as const,
    optimizationLevel: 'balanced' as const,
  },
  isGenerating: false,
};

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setProjectConfig: (config) =>
        set((state) => ({
          projectConfig: { ...state.projectConfig, ...config },
        })),

      setStudyMetadata: (metadata) =>
        set((state) => ({
          studyMetadata: { ...state.studyMetadata, ...metadata },
        })),

      setStandards: (standards) =>
        set((state) => ({
          sdtmVersion: standards.sdtmVersion || state.sdtmVersion,
          adamIgVersion: standards.adamIgVersion || state.adamIgVersion,
          medraVersion: standards.medraVersion || state.medraVersion,
        })),

      setDatasets: (datasets) => set({ selectedDatasets: datasets }),

      setVariables: (variables) => set({ selectedVariables: variables }),

      addRule: (rule) =>
        set((state) => ({
          rules: [...state.rules, rule],
        })),

      updateRule: (id, updates) =>
        set((state) => ({
          rules: state.rules.map((rule) =>
            rule.id === id ? { ...rule, ...updates } : rule
          ),
        })),

      deleteRule: (id) =>
        set((state) => ({
          rules: state.rules.filter((rule) => rule.id !== id),
        })),

      setGenerationOptions: (options) =>
        set((state) => ({
          generationOptions: { ...state.generationOptions, ...options },
        })),

      setIsGenerating: (generating) => set({ isGenerating: generating }),

      getCompletionPercentage: () => {
        const state = get();
        let completed = 0;
        let total = 3; // Reduced from 5: Project Config, Standards, Rules only

        // Check project config (33.33%)
        if (
          state.projectConfig.studyId &&
          state.projectConfig.protocolNumber &&
          state.projectConfig.sponsor
        ) {
          completed += 1;
        }

        // Check standards (33.33%)
        if (
          state.sdtmVersion &&
          state.adamIgVersion &&
          state.medraVersion
        ) {
          completed += 1;
        }

        // Check rules (33.33%)
        if (state.rules.length > 0) {
          completed += 1;
        }

        // SDTM datasets and variables are NO LONGER required for completion

        return Math.round((completed / total) * 100);
      },

      getTabStatus: (tabKey) => {
        const state = get();

        switch (tabKey) {
          case 'project':
            if (
              state.projectConfig.studyId &&
              state.projectConfig.protocolNumber &&
              state.projectConfig.sponsor
            ) {
              return 'complete';
            }
            if (state.projectConfig.studyId || state.projectConfig.protocolNumber) {
              return 'incomplete';
            }
            return 'not-started';

          case 'standards':
            if (state.sdtmVersion && state.adamIgVersion && state.medraVersion) {
              return 'complete';
            }
            return 'incomplete';

          case 'data':
            // Data tab is now OPTIONAL - always show as complete/info-only
            return 'complete';

          case 'rules':
            if (state.rules.length > 0) {
              return 'complete';
            }
            return 'not-started';

          case 'generate':
            const percentage = get().getCompletionPercentage();
            if (percentage === 100) {
              return 'complete';
            }
            if (percentage > 0) {
              return 'incomplete';
            }
            return 'not-started';

          default:
            return 'not-started';
        }
      },

      reset: () => set(initialState),
    }),
    {
      name: 'adam-ai-storage',
      version: 1,
    }
  )
);
