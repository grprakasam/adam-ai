/**
 * TypeScript types for R Execution
 */

export type ExecutionMode = 'interactive' | 'adam';
export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'timeout';

export interface RExecutionRequest {
  code: string;
  r_version?: string;
  mode?: ExecutionMode;
  timeout_seconds?: number;
  memory_limit_mb?: number;
  capture_plots?: boolean;
}

export interface RExecutionResponse {
  run_id: string;
  status: RunStatus;
  message: string;
  stream_url: string;
}

export interface RExecutionStatus {
  run_id: string;
  status: RunStatus;
  mode: ExecutionMode;
  r_version: string;
  progress_percent: number;
  current_step: string;
  started_at: string;
  finished_at?: string;
  duration_seconds?: number;
  error_message?: string;
}

export interface PlotInfo {
  index: number;
  filename: string;
  path: string;
  size_bytes: number;
  format: string;
}

export interface DataFrameInfo {
  name: string;
  rows: number;
  columns: number;
  column_names: string[];
  preview_rows: Record<string, any>[];
}

export interface RExecutionOutput {
  stdout: string[];
  stderr: string[];
  plots: PlotInfo[];
  data_frames: DataFrameInfo[];
  files: string[];
  exit_code: number;
  error_message?: string;
}

export interface RExecutionResult {
  run_id: string;
  status: RunStatus;
  mode: ExecutionMode;
  r_version: string;
  code_hash: string;
  execution_duration: number;
  output: RExecutionOutput;
  started_at: string;
  finished_at: string;
  resource_usage?: Record<string, any>;
}

export interface RVersion {
  version: string;
  docker_image: string;
  is_default: boolean;
  is_recommended: boolean;
}

export interface ProgressEvent {
  run_id: string;
  status: RunStatus;
  progress_percent: number;
  current_step: string;
  error_message?: string;
}

export interface ExecutionCapabilities {
  docker_available: boolean;
  local_r_available: boolean;
  preferred_method: 'docker' | 'local_r' | 'none';
  docker_error?: string;
  local_r_error?: string;
  local_r_version?: string;
  local_r_path?: string;
  recommendation: string;
}
