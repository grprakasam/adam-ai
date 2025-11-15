// Type definitions for ADAM AI Application

export enum ProgrammingLanguage {
  R = 'R',
  SAS = 'SAS'
}

export enum LLMProvider {
  GROQ = 'groq',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  OPENROUTER = 'openrouter'
}

export interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing?: {
    prompt: string;
    completion: string;
  };
  description?: string;
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
}

export interface StudyMetadata {
  studyId: string;
  protocolNumber: string;
  therapeuticArea: string;
  studyPhase: string;
}

export interface ProjectConfiguration {
  studyId: string;
  protocolNumber: string;
  sponsor: string;
  therapeuticArea: string;
  studyPhase: string;
  sdtmVersion: string;
  adamIgVersion: string;
  medraVersion: string;
  programmingLanguage: string;
  adamDataset?: string; // ADSL, ADAE, ADLB
}

export interface SDTMDataset {
  name: string;
  description: string;
  required: boolean;
  selected: boolean;
}

export interface Variable {
  name: string;
  label: string;
  category: string;
  required: boolean;
  dependencies?: string[];
  selected: boolean;
}

// Variable Categorization Types
export interface VariableInfo {
  name: string;
  label?: string;
  type?: string;
  length?: string;
  format?: string;
  origin?: string;
  category: string;
  derivation?: string;
  is_required: boolean;
  extra?: Record<string, string>;
}

export interface VariableCategory {
  name: string;
  description?: string;
  variables: VariableInfo[];
  count: number;
}

export interface CategorizationResult {
  categories: VariableCategory[];
  total_variables: number;
  categorized_count: number;
  uncategorized_count: number;
  dataset_type: string;
  spec_columns?: string[];
}

// Code Snippet Generation Types
export interface CodeSnippetRequest {
  study_id: string;
  dataset: string;
  variable: string;
  derivation: string;
  spec_row: Record<string, string>;
  standards: {
    sdtm_version: string;
    adam_ig_version: string;
    meddra_version: string;
  };
  language: 'R' | 'SAS';
  context: {
    available_sdtm_domains: string[];
    required_variables: string[];
    category: string;
  };
  llm_provider?: string;
  model?: string | null;
  user_note?: string;
}

export interface CodeSnippetResponse {
  variable: string;  // Variable name - REQUIRED for bulk operations
  code_snippet: string;
  coding_rationale: string;
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
  warnings?: string[];
  validated?: boolean;
  error?: string;
}

export interface ConsolidatedVariable {
  name: string;
  category: string;
  code_snippet: string;
  user_notes?: string;
  derivation_logic?: string;
  metadata?: {
    type?: string;
    length?: string;
    format?: string;
    label?: string;
    required?: boolean;
  };
}

export interface ConsolidatedCodeSummary {
  total_variables: number;
  categories_included: number;
  lines_of_code: number;
  file_size_kb: number;
  optimizations_applied: string[];
  generation_time_seconds: number;
  confidence_score?: number;
}

export interface ConsolidatedValidationResult {
  syntax_valid: boolean;
  cdisc_compliant: boolean;
  warnings: string[];
  errors: string[];
}

export interface ConsolidatedGenerationMetadata {
  generated_at: string;
  llm_provider: 'gemini' | 'openai' | 'anthropic' | 'ollama';
  model_used: string;
  execution_mode: 'api' | 'local';
}

export interface ConsolidatedCodeData {
  consolidated_code: string;
  summary: ConsolidatedCodeSummary;
  validation_results: ConsolidatedValidationResult;
  metadata: ConsolidatedGenerationMetadata;
}

export interface ConsolidatedCodeResponse {
  status: 'success' | 'error';
  data?: ConsolidatedCodeData;
  message?: string;
  error_code?: string;
}

export interface ConsolidatedCodeRequest {
  study_id: string;
  dataset: 'ADSL' | 'ADAE' | 'ADLB' | 'ADCM' | 'ADVS';
  language: 'R' | 'SAS';
  comment_verbosity: 'low' | 'medium' | 'high';
  execution_mode: 'api' | 'local';
  approved_variables: ConsolidatedVariable[];
  user_preferences?: Record<string, unknown>;
  standards_version?: Record<string, string>;
}

export interface GenerationOptions {
  includeComments: 'comprehensive' | 'minimal' | 'none';
  codeStyle: 'standard' | 'compact' | 'verbose';
  optimizationLevel: 'balanced' | 'performance' | 'readability';
}

export interface GenerationRequest {
  studyMetadata: StudyMetadata;
  selectedDatasets: string[];
  selectedVariables: string[];
  language: ProgrammingLanguage;
  llmProvider: LLMProvider;
  options: GenerationOptions;
}

export interface ValidationResult {
  category: string;
  status: 'pass' | 'warning' | 'error';
  message: string;
}

export interface DerivationStep {
  sequence: number;
  variable: string;
  dependencies: string;
}

export interface QualityMetrics {
  compliance: number;
  efficiency: number;
  coverage: string;
  readability: string;
}

export interface GenerationResponse {
  code: string;
  validationResults: ValidationResult[];
  derivationSequence: DerivationStep[];
  qualityMetrics: QualityMetrics;
  documentation: {
    variableDetails: string;
    dataSources: string;
    implementationNotes: string;
  };
}
