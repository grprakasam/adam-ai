/**
 * TypeScript types for ADAM Generation
 */

export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'timeout';

export interface RVersionInfo {
  version: string;
  docker_image: string;
  is_default: boolean;
  is_recommended: boolean;
  description?: string;
  preinstalled_packages: string[];
}

export interface SDTMInputStatus {
  study_id: string;
  adam_dataset: string;
  required_domains: string[];
  available_domains: string[];
  missing_domains: string[];
  dataset_metadata: Record<string, {
    exists: boolean;
    columns?: string[];
    column_count?: number;
    file_size?: number;
    error?: string;
  }>;
}

export interface AdamGenerationRequest {
  study_id: string;
  adam_dataset: string;
  language?: 'R' | 'SAS';
  r_version?: string;
  consolidated_code_id?: string;
  consolidated_code_text?: string;
  sdtm_domains?: string[];
  use_latest_sdtm?: boolean;
  output_formats?: ('csv' | 'xlsx' | 'rds' | 'zip')[];
  timeout_seconds?: number;
  memory_limit_mb?: number;
  enable_verbose_logging?: boolean;
}

export interface AdamGenerationStatus {
  run_id: string;
  study_id: string;
  adam_dataset: string;
  status: RunStatus;
  progress_percent: number;
  current_step: string;
  started_at: string;
  finished_at?: string;
  duration_seconds?: number;
  output_summary?: Record<string, any>;
  error_code?: string;
  error_message?: string;
  error_details?: Record<string, any>;
}

export interface DatasetPreview {
  columns: string[];
  rows: Record<string, any>[];
  total_rows: number;
  total_columns: number;
  key_variables: string[];
}

export interface AdamGenerationResult {
  run_id: string;
  status: RunStatus;
  adam_dataset: string;
  preview: DatasetPreview;
  download_urls: Record<string, string>;
  file_paths: Record<string, string>;
  r_version: string;
  execution_duration: number;
  input_datasets: string[];
  code_hash: string;
  timestamp: string;
}

export interface AdamFeedbackRequest {
  study_id: string;
  adam_dataset: string;
  run_id?: string;
  rating?: number;
  is_production_ready?: boolean;
  comments?: string;
  user_id?: string;
}

export interface ProgressEvent {
  run_id: string;
  step: string;
  progress_percent: number;
  current_step: string;
  timestamp: string;
  metadata?: Record<string, any>;
  status?: RunStatus;
  error?: string;
}

