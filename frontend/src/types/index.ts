// Type definitions for ADAM AI Application

export enum ProgrammingLanguage {
  R = 'R',
  SAS = 'SAS'
}

export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google'
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
  category: string;
  derivation?: string;
  is_required: boolean;
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
