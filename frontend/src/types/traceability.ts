/**
 * Traceability types for SDTM-ADaM lineage
 */

export interface SourceVariable {
  domain: string;
  variable: string;
  label?: string | null;
}

export interface DerivationStep {
  step_number: number;
  operation: string;
  detail: string;
  code_reference?: string | null;
}

export interface CodeReference {
  language: 'R' | 'SAS';
  snippet_id: string;
  code: string;
  line_number?: number | null;
}

export interface AIInsight {
  anomalies: Array<{ title: string; description: string }>;
  suggestions: Array<{ title: string; rationale: string }>;
  similar_patterns: string[];
  confidence_factors: Record<string, number>;
}

export interface TraceabilityVariable {
  variable_name: string;
  label: string;
  category: string;
  data_type: string;
  length?: number | null;
  format?: string | null;
  is_key: boolean;
  is_required: boolean;

  // Lineage
  sources: SourceVariable[];
  algorithm: string;
  derivation_steps: DerivationStep[];

  // References
  rule_refs: string[];
  code_refs: CodeReference[];

  // Quality Metrics
  confidence: number;
  validation_status: 'valid' | 'warning' | 'error';
  validation_notes?: string | null;

  // AI Insights
  ai_insights?: AIInsight | null;

  // Collaboration
  comments: Array<any>;
  last_updated: string;
  updated_by?: string | null;
}

export interface TraceabilityMatrix {
  study_id: string;
  dataset: string;
  sdtm_version: string;
  adam_ig_version: string;
  generated_at: string;
  generated_by?: string | null;

  variables: TraceabilityVariable[];

  // Summary Statistics
  total_variables: number;
  traced_variables: number;
  average_confidence: number;
  high_confidence_count: number;
  medium_confidence_count: number;
  low_confidence_count: number;

  // Graph Data (React Flow format)
  graph_data?: {
    nodes: any[];
    edges: any[];
    viewport: { x: number; y: number; zoom: number };
  } | null;
}

export interface TraceabilityState {
  matrix: TraceabilityMatrix | null;
  graphData: any | null;
  selectedVariable: string | null;
  isGenerating: boolean;
  lastGenerated: Date | null;
  error: string | null;
}
