import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import type {
  ProjectConfiguration,
  StudyMetadata,
  GenerationOptions,
  CategorizationResult,
  CodeSnippetResponse,
  LLMProvider,
  OpenRouterModel,
  ConsolidatedCodeData,
} from '../types';
import type { TraceabilityMatrix } from '../types/traceability';
import { adamApi } from '../services/api';

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

export interface SubmissionReadinessScore {
  overall: number;
  components: {
    preflight: number;
    controlled_terminology: number;
    p21_validation: number;
    define_xml: number;
    documentation: number;
  };
  recommendations: string[];
  last_updated: string;
}

export interface ActivityLogItem {
  timestamp: string;
  action: string;
  message: string;
  status: 'success' | 'warning' | 'error' | 'info';
  details?: any;
}

export interface ProjectStore {
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

  // Consolidated Code Generation
  commentVerbosity: 'low' | 'medium' | 'high';
  executionMode: 'api' | 'local';
  consolidatedCode: ConsolidatedCodeData | null;
  isGeneratingConsolidated: boolean;
  consolidatedProgress: number;
  consolidatedStatus: string | null;
  consolidatedDuration: number | null;
  setCommentVerbosity: (level: 'low' | 'medium' | 'high') => void;
  setExecutionMode: (mode: 'api' | 'local') => void;
  setConsolidatedCode: (data: ConsolidatedCodeData | null) => void;
  setIsGeneratingConsolidated: (generating: boolean) => void;
  setConsolidatedProgress: (progress: number, status?: string | null) => void;
  setConsolidatedDuration: (seconds: number | null) => void;
  resetConsolidated: () => void;
  canGenerateConsolidated: () => boolean;

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

  // Traceability
  traceabilityMatrix: TraceabilityMatrix | null;
  isGeneratingTraceability: boolean;
  traceabilityError: string | null;
  selectedTraceabilityVariable: string | null;
  traceabilityLastGenerated: Date | null;
  setTraceabilityMatrix: (matrix: TraceabilityMatrix | null) => void;
  setIsGeneratingTraceability: (generating: boolean) => void;
  setTraceabilityError: (error: string | null) => void;
  setSelectedTraceabilityVariable: (variable: string | null) => void;
  generateTraceability: () => Promise<void>;
  clearTraceability: () => void;

  // Submission Readiness
  submissionReadinessScore: SubmissionReadinessScore | null;
  preflightResults: any | null;
  ctResults: any | null;
  p21Results: any | null;
  defineXmlStatus: 'idle' | 'generating' | 'complete' | 'error';
  adrgStatus: 'idle' | 'generating' | 'complete' | 'error';
  sdrgStatus: 'idle' | 'generating' | 'complete' | 'error';
  generatedArtifacts: any[];
  recentActivity: ActivityLogItem[];
  isValidating: boolean;
  isGeneratingPackage: boolean;
  setSubmissionReadinessScore: (score: SubmissionReadinessScore | null) => void;
  refreshReadinessScore: () => Promise<void>;
  runAllValidations: () => Promise<void>;
  runPreflightCheck: () => Promise<void>;
  runCTValidation: () => Promise<void>;
  runP21Validation: () => Promise<void>;
  generateDefineXml: (options?: any) => Promise<void>;
  generateADRG: () => Promise<void>;
  generateSDRG: () => Promise<void>;
  createECTDPackage: (options?: any) => Promise<void>;
  clearValidationResults: () => void;
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
  commentVerbosity: 'medium' as 'low' | 'medium' | 'high',
  executionMode: 'api' as 'api' | 'local',
  consolidatedCode: null as ConsolidatedCodeData | null,
  isGeneratingConsolidated: false,
  consolidatedProgress: 0,
  consolidatedStatus: null as string | null,
  consolidatedDuration: null as number | null,

  // Traceability
  traceabilityMatrix: null as TraceabilityMatrix | null,
  isGeneratingTraceability: false,
  traceabilityError: null as string | null,
  selectedTraceabilityVariable: null as string | null,
  traceabilityLastGenerated: null as Date | null,
};

export const useProjectStore = create<ProjectStore>()(
  subscribeWithSelector(
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
        const total = 5; // Project Config, Dataset, Specification, Variables, Standards

        if (state.projectConfig.studyId) {
          completed += 1;
        }

        if (state.projectConfig.adamDataset) {
          completed += 1;
        }

        if (state.specificationFile) {
          completed += 1;
        }

        if (state.categorizedVariables && state.categorizedVariables.total_variables > 0) {
          completed += 1;
        }

        if (
          state.sdtmVersion &&
          state.adamIgVersion &&
          state.medraVersion
        ) {
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

      setCommentVerbosity: (level) => set({ commentVerbosity: level }),

      setExecutionMode: (mode) => set({ executionMode: mode }),

      setConsolidatedCode: (data) => set({ consolidatedCode: data }),

      setIsGeneratingConsolidated: (generating) =>
        set({ isGeneratingConsolidated: generating }),

      setConsolidatedProgress: (progress, status = null) =>
        set((state) => ({
          consolidatedProgress: progress,
          consolidatedStatus: status ?? state.consolidatedStatus,
        })),

      setConsolidatedDuration: (seconds) =>
        set({ consolidatedDuration: seconds }),

      resetConsolidated: () =>
        set({
          consolidatedCode: null,
          consolidatedProgress: 0,
          consolidatedStatus: null,
          consolidatedDuration: null,
        }),

      canGenerateConsolidated: () => {
        const state = get();
        const snippets = Object.values(state.pairProgramming.snippets);
        if (snippets.length === 0) {
          return false;
        }
        return snippets.every(
          (snippet) => snippet.accepted === 'accept' && !!snippet.codeSnippet
        );
      },

      // Traceability actions
      setTraceabilityMatrix: (matrix) =>
        set({
          traceabilityMatrix: matrix,
          traceabilityLastGenerated: matrix ? new Date() : null,
          traceabilityError: null
        }),

      setIsGeneratingTraceability: (generating) =>
        set({ isGeneratingTraceability: generating }),

      setTraceabilityError: (error) =>
        set({ traceabilityError: error }),

      setSelectedTraceabilityVariable: (variable) =>
        set({ selectedTraceabilityVariable: variable }),

      generateTraceability: async () => {
        const state = get();

        if (!state.specificationFile) {
          set({ traceabilityError: 'No specification file uploaded. Upload an Excel spec under Specification tab.' });
          return;
        }

        if (!state.projectConfig.studyId) {
          set({ traceabilityError: 'Study ID not set. Go to Setup and provide a Study ID.' });
          return;
        }

        if (!state.projectConfig.adamDataset) {
          set({ traceabilityError: 'ADaM dataset not selected. Choose a dataset (e.g., ADSL) in Setup.' });
          return;
        }

        set({ isGeneratingTraceability: true, traceabilityError: null });

        try {
          // Collect code snippets
          const codeSnippets: Record<string, any> = {};
          Object.entries(state.pairProgramming.snippets).forEach(([variable, snippet]) => {
            if (snippet.accepted === 'accept' && snippet.codeSnippet) {
              codeSnippets[variable] = {
                language: snippet.language,
                code: snippet.codeSnippet,
              };
            }
          });

          // Call API
          const response = await fetch('/api/v1/traceability/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              study_id: state.projectConfig.studyId,
              dataset: state.projectConfig.adamDataset,
              specification_path: state.specificationFile.path,
              code_snippets: codeSnippets,
              include_ai_insights: true,
              force_refresh: false,
            }),
          });

          if (!response.ok) {
            let detail: string | undefined;
            try {
              const data = await response.json();
              detail = (data && (data.detail || data.message)) ? (data.detail || data.message) : undefined;
            } catch {
              try {
                const text = await response.text();
                detail = text && text.length < 400 ? text : undefined;
              } catch {}
            }

            const statusLine = `HTTP ${response.status} ${response.statusText || ''}`.trim();

            // Friendly hints based on common cases
            let hint = '';
            if (response.status === 404) {
              // Either route not found or spec file missing on server
              if (!detail || /not found/i.test(detail)) {
                hint = `Check that backend is running and the specification file exists at '${state.specificationFile.path}' relative to project root.`;
              }
            } else if (response.status === 400) {
              hint = 'The specification format or dataset sheet may be invalid. Ensure the workbook contains a sheet named for the dataset (e.g., ADSL, Variables, Spec, or Sheet1).';
            } else if (response.status >= 500) {
              hint = 'Server error during traceability generation. See backend logs for details.';
            }

            const composed = [statusLine, detail, hint].filter(Boolean).join(' — ');
            throw new Error(composed || 'Traceability generation failed');
          }

          const matrix: TraceabilityMatrix = await response.json();
          set({
            traceabilityMatrix: matrix,
            traceabilityLastGenerated: new Date(),
            traceabilityError: null
          });
        } catch (error: any) {
          const msg = (error && error.message) ? error.message : 'Failed to generate traceability matrix';
          set({ traceabilityError: msg });
        } finally {
          set({ isGeneratingTraceability: false });
        }
      },

      clearTraceability: () =>
        set({
          traceabilityMatrix: null,
          traceabilityError: null,
          selectedTraceabilityVariable: null,
          traceabilityLastGenerated: null,
        }),

      // Submission Readiness
      submissionReadinessScore: null,
      preflightResults: null,
      ctResults: null,
      p21Results: null,
      defineXmlStatus: 'idle' as 'idle' | 'generating' | 'complete' | 'error',
      adrgStatus: 'idle' as 'idle' | 'generating' | 'complete' | 'error',
      sdrgStatus: 'idle' as 'idle' | 'generating' | 'complete' | 'error',
      generatedArtifacts: [],
      recentActivity: [],
      isValidating: false,
      isGeneratingPackage: false,

      setSubmissionReadinessScore: (score: SubmissionReadinessScore | null) =>
        set({ submissionReadinessScore: score }),

      refreshReadinessScore: async () => {
        const { projectConfig, recentActivity } = get();
        if (!projectConfig.studyId || !projectConfig.adamDataset) {
          console.warn('Study ID and dataset required for readiness score');
          return;
        }

        try {
          const data = await adamApi.getSubmissionReadiness(
            projectConfig.studyId,
            projectConfig.adamDataset
          );
          set({ submissionReadinessScore: data.data || data });
        } catch (error) {
          console.error('Error refreshing readiness score:', error);
          const activity: ActivityLogItem = {
            timestamp: new Date().toISOString(),
            action: 'readiness_refresh',
            message: 'Failed to refresh readiness score',
            status: 'error',
            details: error instanceof Error ? error.message : 'Unknown error',
          };
          set({ recentActivity: [activity, ...recentActivity.slice(0, 49)] });
        }
      },

      runAllValidations: async () => {
        const { projectConfig, recentActivity } = get();
        if (!projectConfig.studyId || !projectConfig.adamDataset) {
          console.warn('Study ID and dataset required for validation');
          return;
        }

        set({ isValidating: true });
        const startActivity: ActivityLogItem = {
          timestamp: new Date().toISOString(),
          action: 'validation_start',
          message: 'Starting all validations (Pre-P21, CT, P21)',
          status: 'info',
        };
        set({ recentActivity: [startActivity, ...recentActivity.slice(0, 49)] });

        try {
          const data = await adamApi.runAllValidations({
            study_id: projectConfig.studyId,
            dataset: projectConfig.adamDataset,
          });

          set({
            preflightResults: data.preflight,
            ctResults: data.controlled_terminology || data.ct,
            p21Results: data.p21,
          });

          const successActivity: ActivityLogItem = {
            timestamp: new Date().toISOString(),
            action: 'validation_complete',
            message: 'All validations completed successfully',
            status: 'success',
            details: {
              preflight_passed: data.preflight?.passed,
              ct_passed: data.controlled_terminology?.passed || data.ct?.passed,
              p21_passed: data.p21?.passed,
            },
          };
          set({ recentActivity: [successActivity, ...get().recentActivity.slice(0, 49)] });

          // Refresh score after validation
          get().refreshReadinessScore();
        } catch (error) {
          console.error('Validation error:', error);
          const errorActivity: ActivityLogItem = {
            timestamp: new Date().toISOString(),
            action: 'validation_error',
            message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 'error',
          };
          set({ recentActivity: [errorActivity, ...get().recentActivity.slice(0, 49)] });
        } finally {
          set({ isValidating: false });
        }
      },

      runPreflightCheck: async () => {
        const { projectConfig, recentActivity } = get();
        if (!projectConfig.studyId || !projectConfig.adamDataset) return;

        const startActivity: ActivityLogItem = {
          timestamp: new Date().toISOString(),
          action: 'preflight_start',
          message: 'Running Pre-P21 structural checks',
          status: 'info',
        };
        set({ recentActivity: [startActivity, ...recentActivity.slice(0, 49)] });

        try {
          const data = await adamApi.runPreflightValidation({
            study_id: projectConfig.studyId,
            dataset: projectConfig.adamDataset,
          });
          set({ preflightResults: data });

          const resultActivity: ActivityLogItem = {
            timestamp: new Date().toISOString(),
            action: 'preflight_complete',
            message: data.passed ? 'Pre-P21 checks passed' : `Pre-P21 checks found ${data.issues?.length || 0} issues`,
            status: data.passed ? 'success' : 'warning',
            details: data,
          };
          set({ recentActivity: [resultActivity, ...get().recentActivity.slice(0, 49)] });
        } catch (error) {
          console.error('Preflight error:', error);
          const errorActivity: ActivityLogItem = {
            timestamp: new Date().toISOString(),
            action: 'preflight_error',
            message: `Pre-P21 check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 'error',
          };
          set({ recentActivity: [errorActivity, ...get().recentActivity.slice(0, 49)] });
        }
      },

      runCTValidation: async () => {
        const { projectConfig, recentActivity } = get();
        if (!projectConfig.studyId || !projectConfig.adamDataset) return;

        const startActivity: ActivityLogItem = {
          timestamp: new Date().toISOString(),
          action: 'ct_validation_start',
          message: 'Running Controlled Terminology validation',
          status: 'info',
        };
        set({ recentActivity: [startActivity, ...recentActivity.slice(0, 49)] });

        try {
          const data = await adamApi.runCTValidation({
            study_id: projectConfig.studyId,
            dataset: projectConfig.adamDataset,
          });
          set({ ctResults: data });

          const resultActivity: ActivityLogItem = {
            timestamp: new Date().toISOString(),
            action: 'ct_validation_complete',
            message: data.passed
              ? `CT validation passed (${data.variables_checked || 0} variables checked)`
              : `CT validation found ${data.issues?.length || 0} issues`,
            status: data.passed ? 'success' : 'warning',
            details: data,
          };
          set({ recentActivity: [resultActivity, ...get().recentActivity.slice(0, 49)] });
        } catch (error) {
          console.error('CT validation error:', error);
          const errorActivity: ActivityLogItem = {
            timestamp: new Date().toISOString(),
            action: 'ct_validation_error',
            message: `CT validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 'error',
          };
          set({ recentActivity: [errorActivity, ...get().recentActivity.slice(0, 49)] });
        }
      },

      runP21Validation: async () => {
        const { projectConfig, recentActivity } = get();
        if (!projectConfig.studyId || !projectConfig.adamDataset) return;

        const startActivity: ActivityLogItem = {
          timestamp: new Date().toISOString(),
          action: 'p21_validation_start',
          message: 'Running P21 Community Edition validation',
          status: 'info',
        };
        set({ recentActivity: [startActivity, ...recentActivity.slice(0, 49)] });

        try {
          const data = await adamApi.runP21Validation({
            study_id: projectConfig.studyId,
            dataset: projectConfig.adamDataset,
          });
          set({ p21Results: data });

          const errorCount = data.summary?.errors || 0;
          const warningCount = data.summary?.warnings || 0;
          const resultActivity: ActivityLogItem = {
            timestamp: new Date().toISOString(),
            action: 'p21_validation_complete',
            message: data.passed
              ? 'P21 validation passed'
              : `P21 validation: ${errorCount} errors, ${warningCount} warnings`,
            status: data.passed ? 'success' : (errorCount > 0 ? 'error' : 'warning'),
            details: data,
          };
          set({ recentActivity: [resultActivity, ...get().recentActivity.slice(0, 49)] });
        } catch (error) {
          console.error('P21 validation error:', error);
          const errorActivity: ActivityLogItem = {
            timestamp: new Date().toISOString(),
            action: 'p21_validation_error',
            message: `P21 validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 'error',
          };
          set({ recentActivity: [errorActivity, ...get().recentActivity.slice(0, 49)] });
        }
      },

      generateDefineXml: async () => {
        const { projectConfig, categorizedVariables, recentActivity } = get();
        set({ defineXmlStatus: 'generating' });

        const startActivity: ActivityLogItem = {
          timestamp: new Date().toISOString(),
          action: 'define_xml_start',
          message: 'Generating Define.xml',
          status: 'info',
        };
        set({ recentActivity: [startActivity, ...recentActivity.slice(0, 49)] });

        try {
          const variables = categorizedVariables?.categories?.flatMap(cat =>
            cat.variables.map(v => ({
              name: v.name,
              label: v.label || v.name,
              type: v.type || 'Char',
              length: v.length ? parseInt(String(v.length), 10) : undefined,
              format: v.format || undefined,
              origin: 'Derived',
              role: 'Analysis Variable',
            }))
          ) || [];

          const data = await adamApi.generateDefineXml({
            study_id: projectConfig.studyId,
            dataset: projectConfig.adamDataset || 'ADSL',
            variables,
            include_value_lists: true,
            include_methods: true,
          });

          set({
            defineXmlStatus: 'complete',
            generatedArtifacts: [...get().generatedArtifacts, data.artifact],
          });

          const successActivity: ActivityLogItem = {
            timestamp: new Date().toISOString(),
            action: 'define_xml_complete',
            message: 'Define.xml generated successfully',
            status: 'success',
            details: data.artifact,
          };
          set({ recentActivity: [successActivity, ...get().recentActivity.slice(0, 49)] });
        } catch (error) {
          console.error('Define.xml generation error:', error);
          set({ defineXmlStatus: 'error' });

          const errorActivity: ActivityLogItem = {
            timestamp: new Date().toISOString(),
            action: 'define_xml_error',
            message: `Define.xml generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 'error',
          };
          set({ recentActivity: [errorActivity, ...get().recentActivity.slice(0, 49)] });
        }
      },

      generateADRG: async () => {
        const { projectConfig, recentActivity } = get();
        set({ adrgStatus: 'generating' });

        const startActivity: ActivityLogItem = {
          timestamp: new Date().toISOString(),
          action: 'adrg_start',
          message: 'Generating ADRG document',
          status: 'info',
        };
        set({ recentActivity: [startActivity, ...recentActivity.slice(0, 49)] });

        try {
          const datasetName = projectConfig.adamDataset || 'ADSL';
          const datasets = [{
            name: datasetName,
            label: `${datasetName} Dataset`,
            structure: 'One record per subject',
            purpose: 'Analysis',
          }];

          const data = await adamApi.generateADRG({
            study_info: {
              study_id: projectConfig.studyId,
              protocol_number: projectConfig.protocolNumber,
              study_name: projectConfig.studyId,
              sponsor: projectConfig.sponsor,
            },
            datasets,
            include_derivations: true,
            include_validation_summary: true,
          });

          set({
            adrgStatus: 'complete',
            generatedArtifacts: [...get().generatedArtifacts, data.artifact],
          });

          const successActivity: ActivityLogItem = {
            timestamp: new Date().toISOString(),
            action: 'adrg_complete',
            message: 'ADRG generated successfully',
            status: 'success',
            details: data.artifact,
          };
          set({ recentActivity: [successActivity, ...get().recentActivity.slice(0, 49)] });
        } catch (error) {
          console.error('ADRG generation error:', error);
          set({ adrgStatus: 'error' });

          const errorActivity: ActivityLogItem = {
            timestamp: new Date().toISOString(),
            action: 'adrg_error',
            message: `ADRG generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 'error',
          };
          set({ recentActivity: [errorActivity, ...get().recentActivity.slice(0, 49)] });
        }
      },

      generateSDRG: async () => {
        const { projectConfig, recentActivity } = get();
        set({ sdrgStatus: 'generating' });

        const startActivity: ActivityLogItem = {
          timestamp: new Date().toISOString(),
          action: 'sdrg_start',
          message: 'Generating SDRG document',
          status: 'info',
        };
        set({ recentActivity: [startActivity, ...recentActivity.slice(0, 49)] });

        try {
          const datasetName = projectConfig.adamDataset || 'ADSL';
          const datasets = [{
            name: datasetName,
            label: `${datasetName} Dataset`,
            structure: 'One record per subject',
            purpose: 'Analysis',
          }];

          const data = await adamApi.generateSDRG({
            study_info: {
              study_id: projectConfig.studyId,
              protocol_number: projectConfig.protocolNumber,
              study_name: projectConfig.studyId,
              sponsor: projectConfig.sponsor,
            },
            datasets,
          });

          set({
            sdrgStatus: 'complete',
            generatedArtifacts: [...get().generatedArtifacts, data.artifact],
          });

          const successActivity: ActivityLogItem = {
            timestamp: new Date().toISOString(),
            action: 'sdrg_complete',
            message: 'SDRG generated successfully',
            status: 'success',
            details: data.artifact,
          };
          set({ recentActivity: [successActivity, ...get().recentActivity.slice(0, 49)] });
        } catch (error) {
          console.error('SDRG generation error:', error);
          set({ sdrgStatus: 'error' });

          const errorActivity: ActivityLogItem = {
            timestamp: new Date().toISOString(),
            action: 'sdrg_error',
            message: `SDRG generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 'error',
          };
          set({ recentActivity: [errorActivity, ...get().recentActivity.slice(0, 49)] });
        }
      },

      createECTDPackage: async (options?: any) => {
        const { projectConfig, recentActivity } = get();
        if (!projectConfig.studyId) return;

        set({ isGeneratingPackage: true });

        const startActivity: ActivityLogItem = {
          timestamp: new Date().toISOString(),
          action: 'ectd_package_start',
          message: 'Creating eCTD submission package',
          status: 'info',
        };
        set({ recentActivity: [startActivity, ...recentActivity.slice(0, 49)] });

        try {
          const data = await adamApi.createECTDPackage({
            study_id: projectConfig.studyId,
            datasets: [projectConfig.adamDataset || 'ADSL'],
            include_define_xml: options?.include_define_xml ?? true,
            include_adrg: options?.include_adrg ?? true,
            include_sdrg: options?.include_sdrg ?? true,
            include_programs: options?.include_programs ?? false,
            create_zip: options?.create_zip ?? false,
          });

          set({
            generatedArtifacts: [...get().generatedArtifacts, ...(data.artifacts || [data.artifact])],
          });

          const successActivity: ActivityLogItem = {
            timestamp: new Date().toISOString(),
            action: 'ectd_package_complete',
            message: `eCTD package created successfully${data.tree ? ` (${data.tree.length} items)` : ''}`,
            status: 'success',
            details: {
              artifact: data.artifact,
              tree: data.tree,
              manifest: data.manifest,
            },
          };
          set({ recentActivity: [successActivity, ...get().recentActivity.slice(0, 49)] });
        } catch (error) {
          console.error('Package generation error:', error);

          const errorActivity: ActivityLogItem = {
            timestamp: new Date().toISOString(),
            action: 'ectd_package_error',
            message: `eCTD package creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            status: 'error',
          };
          set({ recentActivity: [errorActivity, ...get().recentActivity.slice(0, 49)] });
        } finally {
          set({ isGeneratingPackage: false });
        }
      },

      clearValidationResults: () =>
        set({
          preflightResults: null,
          ctResults: null,
          p21Results: null,
          defineXmlStatus: 'idle',
          adrgStatus: 'idle',
          sdrgStatus: 'idle',
        }),
    }),
      {
        name: 'adam-ai-storage',
        version: 2,
        partialize: (state) => {
          const { tempSpecFile: _tempSpecFile, ...rest } = state as any;
          return rest;
        },
      }
    )
  )
);
