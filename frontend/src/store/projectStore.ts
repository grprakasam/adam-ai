import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProjectConfiguration, StudyMetadata, GenerationOptions, CategorizationResult, CodeSnippetResponse, LLMProvider, OpenRouterModel } from '../types';

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

export interface VariableSnippet {
  variable: string;
  codeSnippet: string;
  rationale: string;
  userNotes: string;
  accepted: 'accept' | 'modify' | null;
  generatedAt: Date;
  language: 'R' | 'SAS';
  error?: string;
  metadata?: {
    provider?: string;
    model?: string;
    tokens_used?: number;
    latency_ms?: number;
    template_used?: string;
    confidence_score?: number;
    user_note_applied?: boolean;
    user_note_summary?: string;
  };
}

export interface PairProgrammingState {
  snippets: Record<string, VariableSnippet>;
  isGenerating: Record<string, boolean>;
}

export interface CdiscConfiguration {
  adamIgVersion: string;
  sdtmVersion: string;
  medraVersion: string;
  sdtmDomains: string[];
  controlledTerminology: string;
  additionalNotes?: string;
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

  // CDISC Configuration
  cdiscConfig: CdiscConfiguration | null;
  setCdiscConfig: (config: CdiscConfiguration) => void;

  // Rules
  rules: Rule[];
  addRule: (rule: Rule) => void;
  updateRule: (id: string, updates: Partial<Rule>) => void;
  deleteRule: (id: string) => void;

  // Specification File
  specificationFile: SpecificationFile | null;
  setSpecificationFile: (file: SpecificationFile | null) => void;

  // Transient spec file blob (not persisted)
  tempSpecFile: File | null;
  setTempSpecFile: (file: File | null) => void;

  // Categorized Variables
  categorizedVariables: CategorizationResult | null;
  setCategorizedVariables: (result: CategorizationResult | null) => void;
  isCategorizingVariables: boolean;
  setIsCategorizingVariables: (categorizing: boolean) => void;

  // Pair Programming State
  pairProgramming: PairProgrammingState;
  programmingLanguage: 'R' | 'SAS';
  llmProvider: LLMProvider;
  selectedModel: string | null;
  availableModels: OpenRouterModel[];
  llmConnectionStatus: 'untested' | 'testing' | 'connected' | 'failed';
  llmConnectionMessage: string | null;
  setProgrammingLanguage: (language: 'R' | 'SAS') => void;
  setLlmProvider: (provider: LLMProvider) => void;
  setSelectedModel: (modelId: string | null) => void;
  setAvailableModels: (models: OpenRouterModel[]) => void;
  setLlmConnectionStatus: (status: 'untested' | 'testing' | 'connected' | 'failed', message?: string | null) => void;
  setPairProgrammingSnippet: (variable: string, snippet: VariableSnippet) => void;
  setGeneratingSnippet: (variable: string, isGenerating: boolean) => void;
  setPairProgrammingNotes: (variable: string, notes: string) => void;
  setPairProgrammingAcceptance: (variable: string, accepted: 'accept' | 'modify' | null) => void;
  setBulkCodeSnippets: (snippets: CodeSnippetResponse[]) => void;

  // Generation Options
  generationOptions: GenerationOptions;
  setGenerationOptions: (options: Partial<GenerationOptions>) => void;

  // UI State
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
  
  // Workspace Initialization
  isWorkspaceInitialized: boolean;
  initializeWorkspace: () => void;
  resetWorkspace: () => void;

  // Computed values
  getCompletionPercentage: () => number;
  getTabStatus: (tabKey: string) => 'complete' | 'incomplete' | 'warning' | 'not-started';

  // Reset
  reset: () => void;

  // Cleanup helpers
  cleanupLoadingStates: () => void;
  cleanupGenerationStates: () => void;
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
  cdiscConfig: null,
  rules: [],
  specificationFile: null,
  tempSpecFile: null,
  categorizedVariables: null,
  isCategorizingVariables: false,
  pairProgramming: {
    snippets: {},
    isGenerating: {},
  },
  programmingLanguage: 'R' as 'R' | 'SAS',
  llmProvider: 'groq' as LLMProvider,
  selectedModel: null,
  availableModels: [],
  llmConnectionStatus: 'untested' as 'untested' | 'testing' | 'connected' | 'failed',
  llmConnectionMessage: null,
  generationOptions: {
    includeComments: 'comprehensive' as const,
    codeStyle: 'standard' as const,
    optimizationLevel: 'balanced' as const,
  },
  isGenerating: false,
  isWorkspaceInitialized: false,
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

      setCdiscConfig: (config) =>
        set({ cdiscConfig: config }),

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

      setTempSpecFile: (file) => set({ tempSpecFile: file }),

      setCategorizedVariables: (result) =>
        set({ categorizedVariables: result }),

      setIsCategorizingVariables: (categorizing) =>
        set({ isCategorizingVariables: categorizing }),

      // Pair Programming Actions
      setProgrammingLanguage: (language) =>
        set({ programmingLanguage: language }),

      setLlmProvider: (provider) =>
        set({ llmProvider: provider, llmConnectionStatus: 'untested', llmConnectionMessage: null }),

      setSelectedModel: (modelId) =>
        set({ selectedModel: modelId }),

      setAvailableModels: (models) =>
        set({ availableModels: models }),

      setLlmConnectionStatus: (status, message = null) =>
        set({ llmConnectionStatus: status, llmConnectionMessage: message }),

      setPairProgrammingSnippet: (variable, snippet) =>
        set((state) => ({
          pairProgramming: {
            ...state.pairProgramming,
            snippets: {
              ...state.pairProgramming.snippets,
              [variable]: snippet,
            },
          },
        })),

      setGeneratingSnippet: (variable, isGenerating) =>
        set((state) => ({
          pairProgramming: {
            ...state.pairProgramming,
            isGenerating: {
              ...state.pairProgramming.isGenerating,
              [variable]: isGenerating,
            },
          },
        })),

      setPairProgrammingNotes: (variable, notes) =>
        set((state) => ({
          pairProgramming: {
            ...state.pairProgramming,
            snippets: {
              ...state.pairProgramming.snippets,
              [variable]: {
                ...state.pairProgramming.snippets[variable],
                userNotes: notes,
              },
            },
          },
        })),

      setPairProgrammingAcceptance: (variable, accepted) =>
        set((state) => ({
          pairProgramming: {
            ...state.pairProgramming,
            snippets: {
              ...state.pairProgramming.snippets,
              [variable]: {
                ...state.pairProgramming.snippets[variable],
                accepted,
              },
            },
          },
        })),

      setBulkCodeSnippets: (snippets) =>
        set((state) => {
          console.log('[setBulkCodeSnippets] Received snippets:', snippets.length);
          console.log('[setBulkCodeSnippets] First snippet sample:', snippets[0]);
          
          const newSnippets: Record<string, VariableSnippet> = {};
          snippets.forEach((snippet: any) => {
            const variable = snippet.variable;
            if (!variable) {
              console.warn('[setBulkCodeSnippets] Snippet missing variable name:', snippet);
              return;
            }
            
            newSnippets[variable] = {
              variable: variable,
              codeSnippet: snippet.code_snippet || '',
              rationale: snippet.coding_rationale || '',
              userNotes: state.pairProgramming.snippets[variable]?.userNotes || '',
              accepted: state.pairProgramming.snippets[variable]?.accepted || 'accept',
              generatedAt: new Date(),
              language: state.programmingLanguage,
              error: snippet.error,
              metadata: snippet.metadata,
            };
            
            console.log(`[setBulkCodeSnippets] Processed ${variable}:`, {
              hasCode: !!snippet.code_snippet,
              hasRationale: !!snippet.coding_rationale,
              hasError: !!snippet.error
            });
          });
          
          console.log('[setBulkCodeSnippets] Total snippets processed:', Object.keys(newSnippets).length);
          
          const updatedState = {
            pairProgramming: {
              ...state.pairProgramming,
              snippets: {
                ...state.pairProgramming.snippets,
                ...newSnippets,
              },
            },
          };
          
          console.log('[setBulkCodeSnippets] Updated state snippets count:', Object.keys(updatedState.pairProgramming.snippets).length);
          
          return updatedState;
        }),

      setGenerationOptions: (options) =>
        set((state) => ({
          generationOptions: { ...state.generationOptions, ...options },
        })),

      setIsGenerating: (generating) => set({ isGenerating: generating }),

      getCompletionPercentage: () => {
        const state = get();
        let completed = 0;
        let total = 6; // Project Config, Dataset, Specification, Variables, Standards, Rules

        // Check project config (16.67%)
        if (state.projectConfig.studyId) {
          completed += 1;
        }

        // Check dataset selection (16.67%)
        if (state.projectConfig.adamDataset) {
          completed += 1;
        }

        // Check specification upload (16.67%)
        if (state.specificationFile) {
          completed += 1;
        }

        // Check variables categorization (16.67%)
        if (state.categorizedVariables && state.categorizedVariables.total_variables > 0) {
          completed += 1;
        }

        // Check standards (16.67%)
        if (
          state.sdtmVersion &&
          state.adamIgVersion &&
          state.medraVersion
        ) {
          completed += 1;
        }

        // Check rules (16.67%)
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

          case 'variables':
            // Check if variables have been categorized
            if (state.categorizedVariables && state.categorizedVariables.total_variables > 0) {
              return 'complete';
            }
            // Show incomplete if spec is uploaded but not categorized yet
            if (state.specificationFile) {
              return 'incomplete';
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
      
      // Workspace initialization
      initializeWorkspace: () => set({ isWorkspaceInitialized: true }),
      
      resetWorkspace: () => set({
        ...initialState,
        isWorkspaceInitialized: false,
      }),

      // Cleanup all loading states
      cleanupLoadingStates: () =>
        set((state) => ({
          isGenerating: false,
          isCategorizingVariables: false,
          pairProgramming: {
            ...state.pairProgramming,
            isGenerating: {},
          },
        })),

      // Cleanup only code generation states
      cleanupGenerationStates: () =>
        set((state) => ({
          pairProgramming: {
            ...state.pairProgramming,
            isGenerating: {},
          },
        })),
    }),
    {
      name: 'adam-ai-storage',
      version: 2,
      partialize: (state) => {
        const { tempSpecFile, ...rest } = state as any;
        return rest;
      },
    }
  )
);
