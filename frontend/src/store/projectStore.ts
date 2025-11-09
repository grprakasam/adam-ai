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

export interface SpecificationFile {
  name: string;
  path: string;
  size: number;
  uploadedAt: string;
  isDefault?: boolean;
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

  // Rules
  rules: Rule[];
  addRule: (rule: Rule) => void;
  updateRule: (id: string, updates: Partial<Rule>) => void;
  deleteRule: (id: string) => void;

  // Specification File
  specificationFile: SpecificationFile | null;
  setSpecificationFile: (file: SpecificationFile | null) => void;

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
    adamDataset: '', // ADSL, ADAE, ADLB
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
  rules: [],
  specificationFile: null,
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

      setSpecificationFile: (file) =>
        set({ specificationFile: file }),

      setGenerationOptions: (options) =>
        set((state) => ({
          generationOptions: { ...state.generationOptions, ...options },
        })),

      setIsGenerating: (generating) => set({ isGenerating: generating }),

      getCompletionPercentage: () => {
        const state = get();
        let completed = 0;
        let total = 5; // Project Config, Dataset, Specification, Standards, Rules

        // Check project config (20%)
        if (state.projectConfig.studyId) {
          completed += 1;
        }

        // Check dataset selection (20%)
        if (state.projectConfig.adamDataset) {
          completed += 1;
        }

        // Check specification upload (20%)
        if (state.specificationFile) {
          completed += 1;
        }

        // Check standards (20%)
        if (
          state.sdtmVersion &&
          state.adamIgVersion &&
          state.medraVersion
        ) {
          completed += 1;
        }

        // Check rules (20%)
        if (state.rules.length > 0) {
          completed += 1;
        }

        return Math.round((completed / total) * 100);
      },

      getTabStatus: (tabKey) => {
        const state = get();

        switch (tabKey) {
          case 'project':
            // Only Study ID is required
            if (state.projectConfig.studyId) {
              return 'complete';
            }
            return 'not-started';

          case 'dataset':
            // Check if ADAM dataset is selected
            if (state.projectConfig.adamDataset) {
              return 'complete';
            }
            return 'not-started';

          case 'specification':
            // Check if specification file is uploaded
            if (state.specificationFile) {
              return 'complete';
            }
            return 'not-started';

          case 'standards':
            if (state.sdtmVersion && state.adamIgVersion && state.medraVersion) {
              return 'complete';
            }
            return 'incomplete';

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
