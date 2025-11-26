import axios, { AxiosError } from 'axios';
import type { AxiosProgressEvent } from 'axios';
import type {
  GenerationRequest,
  GenerationResponse,
  CategorizationResult,
  CodeSnippetRequest,
  CodeSnippetResponse,
  ConsolidatedCodeRequest,
  ConsolidatedCodeResponse,
} from '../types';
import { codeGenerationThrottler, fileUploadThrottler } from '../utils/requestThrottler';

const getApiBaseUrl = () => {
  const envUrl =
    typeof import.meta !== 'undefined'
      ? (((import.meta as any).env?.VITE_API_BASE_URL ?? '').trim())
      : '';

  if (envUrl) {
    return envUrl;
  }

  // In development, use Vite's proxy
  if (import.meta.env.DEV) {
    return '/api/v1';
  }

  // In production, construct full URL
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const normalizedProtocol =
      protocol && protocol.startsWith('http') ? protocol : 'http:';
    const targetHost = hostname || 'localhost';
    return `${normalizedProtocol}//${targetHost}:8000/api/v1`;
  }

  return '/api/v1';
};

const API_BASE_URL = getApiBaseUrl();
const ACCESS_TOKEN_KEY = 'adam_access_token';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 300000, // 5 minutes default timeout (300 seconds) - increased for Docker execution
});

// Request interceptor for adding common headers
apiClient.interceptors.request.use(
  (config) => {
    // Add Authorization header if token exists
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add timestamp to prevent caching
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now()
      };
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Log errors in development
    if (import.meta.env.DEV) {
      console.error('API Error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });
    }
    return Promise.reject(error);
  }
);

export const adamApi = {
  // Generic HTTP methods for custom endpoints
  get: async (url: string, config?: any) => {
    return await apiClient.get(url, config);
  },

  post: async (url: string, data?: any, config?: any) => {
    return await apiClient.post(url, data, config);
  },

  put: async (url: string, data?: any, config?: any) => {
    return await apiClient.put(url, data, config);
  },

  // Health check
  healthCheck: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },

  // Generate ADAM code
  generateCode: async (request: GenerationRequest): Promise<GenerationResponse> => {
    const response = await apiClient.post('/generate', request);
    return response.data;
  },

  // Get available SDTM datasets
  getDatasets: async () => {
    const response = await apiClient.get('/datasets');
    return response.data;
  },

  // Get available variables
  getVariables: async (dataset?: string) => {
    const response = await apiClient.get('/variables', {
      params: { dataset }
    });
    return response.data;
  },

  // Validate code
  validateCode: async (request: { code: string; language: string; check_style?: boolean }) => {
    const response = await apiClient.post('/validation/validate', { 
      check_style: true,
      ...request
    });
    return response.data;
  },

  // LLM defaults
  getLLMDefaults: async () => {
    const response = await apiClient.get('/llm/defaults');
    return response.data;
  },

  // Categorize specification variables
  categorizeSpecification: async (
    specFilePath: string,
    datasetType: string = 'ADSL',
    options?: { signal?: AbortSignal; timeoutMs?: number }
  ): Promise<CategorizationResult> => {
    return await fileUploadThrottler.throttle(async () => {
      const response = await apiClient.post(
        '/specification/categorize-path',
        {
          spec_file_path: specFilePath,
          dataset_type: datasetType,
        },
        {
          signal: options?.signal,
          timeout: options?.timeoutMs ?? 180000, // allow up to 3 minutes for large files
        }
      );
      return response.data;
    });
  },

  // Categorize specification by file upload
  categorizeSpecificationFile: async (
    file: File,
    datasetType: string = 'ADSL',
    options?: { signal?: AbortSignal; timeoutMs?: number; onUploadProgress?: (e: AxiosProgressEvent) => void }
  ): Promise<CategorizationResult> => {
    return await fileUploadThrottler.throttle(async () => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dataset_type', datasetType);

      const response = await apiClient.post('/specification/categorize', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        signal: options?.signal,
        timeout: options?.timeoutMs ?? 180000,
        onUploadProgress: options?.onUploadProgress,
      });
      
      // Debug log to check length/format values
      const result = response.data;
      if (result.categories) {
        const armVars = result.categories.flatMap((cat: any) => 
          cat.variables.filter((v: any) => v.name.includes('ARM'))
        );
        if (armVars.length > 0) {
          console.log('[API] ARM variables from backend:', armVars.map((v: any) => ({
            name: v.name,
            type: v.type,
            length: v.length,
            format: v.format
          })));
        }
      }
      
      return result;
    });
  },

  // Generate code snippet for a single variable
  generateCodeSnippet: async (request: CodeSnippetRequest): Promise<CodeSnippetResponse> => {
    return await codeGenerationThrottler.throttle(async () => {
      const response = await apiClient.post('/code-generation/generate-code-snippet', request);
      return response.data;
    });
  },

  // Generate code for all variables in bulk
  generateCodeBulk: async (request: {
    categorized_variables: CategorizationResult;
    study_id: string;
    dataset: string;
    language: 'R' | 'SAS';
    standards: {
      sdtm_version: string;
      adam_ig_version: string;
      meddra_version: string;
    };
    llm_provider?: string;
  }): Promise<CodeSnippetResponse[]> => {
    return await codeGenerationThrottler.throttle(async () => {
      const response = await apiClient.post('/code-generation/generate-code-bulk', request, {
        timeout: 120000, // 120 seconds for bulk generation
      });
      return response.data;
    });
  },

  // Generate code for all variables in bulk with real-time progress streaming
  generateCodeBulkStream: (
    request: {
      categorized_variables: CategorizationResult;
      study_id: string;
      dataset: string;
      language: 'R' | 'SAS';
      standards: {
        sdtm_version: string;
        adam_ig_version: string;
        meddra_version: string;
      };
      llm_provider?: string;
    },
    onProgress: (progress: {
      status: string;
      total: number;
      completed: number;
      message: string;
      variable_name?: string;
      batch?: number;
      total_batches?: number;
    }) => void
  ): Promise<CodeSnippetResponse[]> => {
    return new Promise((resolve, reject) => {
      const baseURL = apiClient.defaults.baseURL || '';
      const url = `${baseURL}/code-generation/generate-code-bulk-stream`;

      // Get auth token from localStorage
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Use fetch with EventSource fallback
      fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      })
        .then(async (response) => {
          if (!response.ok) {
            // Provide more context for auth errors
            if (response.status === 401) {
              const errorText = await response.text().catch(() => '');
              throw new Error(
                `Authentication required (401). ${
                  !token
                    ? 'Please log in first.'
                    : 'Your session may have expired. Please log in again.'
                } ${errorText ? `Details: ${errorText}` : ''}`
              );
            }
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let results: CodeSnippetResponse[] = [];

          if (!reader) {
            throw new Error('No response body');
          }

          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;

            // Decode chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE messages
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith('event: progress')) {
                continue; // Event type line
              } else if (line.startsWith('event: complete')) {
                continue; // Event type line
              } else if (line.startsWith('event: result')) {
                continue; // Event type line
              } else if (line.startsWith('event: error')) {
                continue; // Event type line
              } else if (line.startsWith('data: ')) {
                const data = line.slice(6); // Remove 'data: ' prefix
                try {
                  const parsed = JSON.parse(data);

                  // Check if this is a progress update
                  if (parsed.status === 'progress' || (parsed.status && !parsed.data)) {
                    onProgress(parsed);
                  }
                  // Check if this is the complete event with results
                  else if (parsed.status === 'success' && Array.isArray(parsed.data)) {
                    results = parsed.data;
                  }
                  // Check if this is just a result array (legacy format)
                  else if (Array.isArray(parsed)) {
                    results = parsed;
                  }
                  // Check if this is an error
                  else if (parsed.error) {
                    reject(new Error(parsed.error));
                    return;
                  }
                } catch (e) {
                  console.error('Failed to parse SSE data:', e, data);
                }
              }
            }
          }

          resolve(results);
        })
        .catch((error) => {
          reject(error);
        });
    });
  },

  // Clear code generation cache
  clearCodeCache: async () => {
    const response = await apiClient.post('/code-generation/clear-cache');
    return response.data;
  },

  // Get code generation statistics
  getCodeGenStats: async () => {
    const response = await apiClient.get('/code-generation/stats');
    return response.data;
  },

  // Rules endpoints
  listRules: async () => {
    const response = await apiClient.get('/rules/list');
    return response.data;
  },

  loadAllRules: async () => {
    const response = await apiClient.get('/rules/load-all');
    return response.data;
  },

  loadRuleByName: async (ruleName: string) => {
    const response = await apiClient.get(`/rules/load/${ruleName}`);
    return response.data;
  },

  loadAdslRules: async () => {
    const response = await apiClient.get('/rules/adsl');
    return response.data;
  },

  // Standards endpoints
  getStandardsSummary: async () => {
    const response = await apiClient.get('/standards/summary');
    return response.data;
  },

  loadAllStandards: async () => {
    const response = await apiClient.get('/standards/load-all');
    return response.data;
  },

  validateStandards: async () => {
    const response = await apiClient.get('/standards/validate');
    return response.data;
  },

  // Program generation endpoints
  generateCompleteProgram: async (request: {
    study_id: string;
    dataset: string;
    language: 'R' | 'SAS';
    categorized_variables: any;
    code_snippets: Record<string, string>;
    standards?: {
      sdtm_version: string;
      adam_ig_version: string;
      meddra_version: string;
    };
    sdtm_domains?: string[];
  }) => {
    return await codeGenerationThrottler.throttle(async () => {
      const response = await apiClient.post('/program-generation/generate', request);
      return response.data;
    });
  },

  generateProgramHeader: async (params: {
    language: string;
    dataset: string;
    study_id: string;
    standards?: any;
  }) => {
    const response = await apiClient.post('/program-generation/generate-header', null, { params });
    return response.data;
  },

  orderVariables: async (variables: any[]) => {
    const response = await apiClient.post('/program-generation/order-variables', variables);
    return response.data;
  },

  // Generate complete program with user notes and preferences
  generateProgramWithNotes: async (request: {
    study_id: string;
    dataset: string;
    language: 'R' | 'SAS';
    categorized_variables: any;
    approved_variables: string[];
    code_snippets: Record<string, string>;
    user_notes: Record<string, string>;
    user_preferences: {
      language: 'R' | 'SAS';
      rPackages?: string[];
      sasProcs?: string[];
      customOptions?: string;
    };
    standards?: {
      sdtm_version: string;
      adam_ig_version: string;
      meddra_version: string;
    };
    sdtm_domains?: string[];
  }) => {
    return await codeGenerationThrottler.throttle(async () => {
      const response = await apiClient.post('/program-generation/generate-with-notes', request);
      return response.data;
    });
  },

  generateConsolidatedCode: async (request: ConsolidatedCodeRequest): Promise<ConsolidatedCodeResponse> => {
    return await codeGenerationThrottler.throttle(async () => {
      const response = await apiClient.post('/program-generation/consolidated', request);
      return response.data;
    });
  },

  // Generate consolidated code with real-time progress streaming
  generateConsolidatedCodeStream: (
    request: ConsolidatedCodeRequest,
    onProgress: (progress: {
      status: string;
      progress_pct: number;
      message: string;
      step?: string;
      elapsed_seconds?: number;
    }) => void,
    abortSignal?: AbortSignal
  ): Promise<ConsolidatedCodeResponse> => {
    return new Promise((resolve, reject) => {
      const baseURL = apiClient.defaults.baseURL || '';
      const url = `${baseURL}/program-generation/consolidated-stream`;

      // Get auth token from localStorage
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      };

      if (abortSignal) {
        fetchOptions.signal = abortSignal;
      }

      fetch(url, fetchOptions)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let result: ConsolidatedCodeResponse | null = null;

          if (!reader) {
            throw new Error('No response body');
          }

          // Check if abort signal is already aborted
          if (abortSignal?.aborted) {
            reader.cancel();
            throw new Error('Generation cancelled by user');
          }

          while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            // Check for abort signal during streaming
            if (abortSignal?.aborted) {
              reader.cancel();
              throw new Error('Generation cancelled by user');
            }

            // Decode chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE messages
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith('event: progress')) {
                continue; // Event type line
              } else if (line.startsWith('event: complete')) {
                continue; // Event type line
              } else if (line.startsWith('event: error')) {
                continue; // Event type line
              } else if (line.startsWith('data: ')) {
                const data = line.slice(6); // Remove 'data: ' prefix
                try {
                  const parsed = JSON.parse(data);

                  // Check if this is a progress update
                  if (parsed.status && parsed.progress_pct !== undefined) {
                    console.log('[SSE Progress]', parsed);
                    onProgress(parsed);
                  }
                  // Check if this is the final result (has status field and data field)
                  else if (parsed.status === 'success' && parsed.data !== undefined) {
                    // Return the entire response object, not just the data
                    console.log('[SSE Complete]', parsed);
                    result = parsed;
                  }
                  // Check if this is an error
                  else if (parsed.error) {
                    console.error('[SSE Error]', parsed.error);
                    reject(new Error(parsed.error));
                    return;
                  } else {
                    console.warn('[SSE Unknown]', parsed);
                  }
                } catch (e) {
                  console.error('Failed to parse SSE data:', e, data);
                }
              }
            }
          }

          if (result) {
            resolve(result);
          } else {
            reject(new Error('No result received from server'));
          }
        })
        .catch((error) => {
          // Don't reject if it's an abort error - let the component handle it
          if (error.name === 'AbortError') {
            reject(new Error('Generation cancelled by user'));
          } else {
            reject(error);
          }
        });
    });
  },

  // Get available OpenRouter models
  getOpenRouterModels: async () => {
    const response = await apiClient.get('/llm-models/openrouter/models');
    return response.data;
  },

  // Get configured LLM providers
  getProviders: async () => {
    const response = await apiClient.get('/llm-models/providers');
    return response.data;
  },

  // Test LLM connection
  testLLMConnection: async (provider: string, model?: string) => {
    const response = await apiClient.post('/llm-models/test-connection', {
      provider,
      model
    });
    return response.data;
  },

  // ============================================
  // SUBMISSION READINESS & VALIDATION
  // ============================================

  // Get submission readiness score
  getSubmissionReadiness: async (studyId: string, dataset: string) => {
    const response = await apiClient.get(`/submission/readiness/${studyId}/${dataset}`);
    return response.data;
  },

  // Run all validations (preflight, CT, P21)
  runAllValidations: async (request: {
    study_id: string;
    dataset: string;
    dataset_paths?: string[];
    ct_file_path?: string;
    stop_on_error?: boolean;
  }) => {
    const response = await apiClient.post('/validation/run-all', request, {
      timeout: 300000, // 5 minutes for full validation suite
    });
    return response.data;
  },

  // Run pre-P21 structural checks
  runPreflightValidation: async (request: {
    study_id: string;
    dataset: string;
    dataset_paths?: string[];
  }) => {
    const response = await apiClient.post('/validation/preflight', request);
    return response.data;
  },

  // Run controlled terminology validation
  runCTValidation: async (request: {
    study_id: string;
    dataset: string;
    dataset_paths?: string[];
    ct_file_path?: string;
  }) => {
    const response = await apiClient.post('/validation/ct', request);
    return response.data;
  },

  // Run P21 Community Edition validation
  runP21Validation: async (request: {
    study_id: string;
    dataset: string;
    dataset_paths?: string[];
    rules?: string[];
    timeout?: number;
  }) => {
    const response = await apiClient.post('/validation/p21', request, {
      timeout: 600000, // 10 minutes for P21
    });
    return response.data;
  },

  // Export validation results
  exportValidationResults: async (request: {
    study_id: string;
    dataset: string;
    format: 'csv' | 'xlsx' | 'json' | 'pdf';
    include_preflight?: boolean;
    include_ct?: boolean;
    include_p21?: boolean;
  }) => {
    const response = await apiClient.post('/validation/export', request, {
      responseType: 'blob',
    });
    return response;
  },

  // ============================================
  // DOCUMENT GENERATION (ADRG/SDRG/Define.xml)
  // ============================================

  // Generate Define.xml
  generateDefineXml: async (request: {
    study_id: string;
    dataset: string;
    variables?: Array<{
      name: string;
      label: string;
      type: string;
      length?: number;
      format?: string;
      origin?: string;
      role?: string;
    }>;
    include_value_lists?: boolean;
    include_methods?: boolean;
  }) => {
    const response = await apiClient.post('/submission/define-xml', request);
    return response.data;
  },

  // Generate ADRG (Analysis Data Reviewer's Guide)
  generateADRG: async (request: {
    study_info: {
      study_id: string;
      protocol_number?: string;
      study_name?: string;
      sponsor?: string;
    };
    datasets: Array<{
      name: string;
      label: string;
      structure?: string;
      purpose?: string;
    }>;
    notes?: string;
    include_derivations?: boolean;
    include_validation_summary?: boolean;
  }) => {
    const response = await apiClient.post('/submission/adrg', request);
    return response.data;
  },

  // Generate SDRG (Study Data Reviewer's Guide)
  generateSDRG: async (request: {
    study_info: {
      study_id: string;
      protocol_number?: string;
      study_name?: string;
      sponsor?: string;
    };
    datasets: Array<{
      name: string;
      label: string;
      structure?: string;
      purpose?: string;
    }>;
    notes?: string;
  }) => {
    const response = await apiClient.post('/submission/sdrg', request);
    return response.data;
  },

  // ============================================
  // eCTD PACKAGING
  // ============================================

  // Create eCTD package
  createECTDPackage: async (request: {
    study_id: string;
    datasets?: string[];
    include_define_xml?: boolean;
    include_adrg?: boolean;
    include_sdrg?: boolean;
    include_programs?: boolean;
    create_zip?: boolean;
    target_dir?: string;
  }) => {
    const response = await apiClient.post('/submission/ectd/package', request, {
      timeout: 300000, // 5 minutes for packaging
    });
    return response.data;
  },

  // Get package status
  getPackageStatus: async (packageId: string) => {
    const response = await apiClient.get(`/submission/ectd/status/${packageId}`);
    return response.data;
  },

  // Download package artifact
  downloadPackageArtifact: async (artifactPath: string) => {
    const response = await apiClient.get('/submission/ectd/download', {
      params: { path: artifactPath },
      responseType: 'blob',
    });
    return response;
  },

  // ============================================
  // CODE EXECUTION & VALIDATION
  // ============================================

  // Check Docker environment status
  checkDockerEnvironment: async () => {
    const response = await apiClient.get('/code-execution/environment-status');
    return response.data;
  },

  // Pull Docker images
  pullDockerImages: async () => {
    const response = await apiClient.post('/code-execution/pull-images');
    return response.data;
  },

  // Execute code snippet
  executeCodeSnippet: async (request: {
    code: string;
    language: 'R' | 'SAS';
    snippet_id?: string;
    test_dataset_ids?: string[];
    timeout?: number;
    execution_env?: 'docker' | 'local';
  }) => {
    // Use longer timeout for Docker execution (5 minutes default)
    const timeoutSeconds = request.timeout || 300; // Default to 300 seconds (5 minutes)
    const timeoutMs = (timeoutSeconds + 30) * 1000; // Add 30 seconds buffer for network overhead and Docker startup
    const response = await apiClient.post('/code-execution/execute-snippet', {
      ...request,
      timeout: timeoutSeconds,
    }, {
      timeout: timeoutMs, // Override axios timeout for this specific request
    });
    return response.data;
  },

  // ============================================
  // ADAM GENERATION
  // ============================================

  // Start ADAM dataset generation
  startAdamGeneration: async (request: {
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
  }) => {
    const response = await apiClient.post('/adam-generation/run', request);
    return response.data;
  },

  // Get run status
  getAdamGenerationStatus: async (runId: string) => {
    const response = await apiClient.get(`/adam-generation/run/${runId}`);
    return response.data;
  },

  // Get run result
  getAdamGenerationResult: async (runId: string) => {
    const response = await apiClient.get(`/adam-generation/run/${runId}/result`);
    return response.data;
  },

  // Download ADAM dataset
  downloadAdamDataset: async (runId: string, format: 'csv' | 'xlsx' | 'rds' | 'zip' = 'csv') => {
    const response = await apiClient.get(`/adam-generation/run/${runId}/download`, {
      params: { format },
      responseType: 'blob',
    });
    return response;
  },

  // Get available R versions
  getRVersions: async () => {
    const response = await apiClient.get('/adam-generation/r-versions');
    return response.data;
  },

  // Submit feedback
  submitAdamGenerationFeedback: async (runId: string, feedback: {
    study_id: string;
    adam_dataset: string;
    rating?: number;
    is_production_ready?: boolean;
    comments?: string;
  }) => {
    const response = await apiClient.post(`/adam-generation/run/${runId}/feedback`, feedback);
    return response.data;
  },

  // Check SDTM inputs
  checkSdtmInputs: async (params: { study_id: string; adam_dataset: string }) => {
    const response = await apiClient.post('/adam-generation/check-inputs', null, { 
      params: {
        study_id: params.study_id,
        adam_dataset: params.adam_dataset
      }
    });
    return response.data;
  },

  // Generate multiple SDTM datasets in batch
  generateSdtmBatch: async (request: {
    domains: string[];
    study_id?: string;
    num_subjects?: number;
    [key: string]: any;
  }) => {
    try {
      const response = await apiClient.post('/test-data/generate-sdtm-batch', request);
      return response.data;
    } catch (error: any) {
      // Log the full error for debugging
      console.error('Batch generation error:', error);
      console.error('Request URL:', error.config?.url);
      console.error('Request data:', request);
      throw error;
    }
  },

  // Validate code (syntax check)
  validateGeneratedCode: async (request: {
    code: string;
    language: 'R' | 'SAS';
  }) => {
    const response = await apiClient.post('/validation/validate', request);
    return response.data;
  },

  // ============================================
  // TEST DATASET MANAGEMENT
  // ============================================

  // List test datasets
  listTestDatasets: async (projectId?: string) => {
    const response = await apiClient.get('/code-execution/test-datasets', {
      params: projectId ? { project_id: projectId } : {}
    });
    return response.data;
  },

  // Upload test dataset
  uploadTestDataset: async (files: File[], name: string, description?: string, projectId?: string) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('name', name);
    if (description) formData.append('description', description);
    if (projectId) formData.append('project_id', projectId);

    const response = await fileUploadThrottler.throttle(async () => {
      return await apiClient.post('/code-execution/test-datasets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // 2 minutes for large files
      });
    });
    return response.data;
  },

  // Delete test dataset
  deleteTestDataset: async (datasetId: string) => {
    const response = await apiClient.delete(`/code-execution/test-datasets/${datasetId}`);
    return response.data;
  },

  // Get test dataset details
  getTestDataset: async (datasetId: string) => {
    const response = await apiClient.get(`/code-execution/test-datasets/${datasetId}`);
    return response.data;
  },

  // ============================================
  // R EXECUTION (INTERACTIVE MODE)
  // ============================================

  // Execute R code
  executeRCode: async (request: {
    code: string;
    r_version?: string;
    mode?: 'interactive' | 'adam';
    timeout_seconds?: number;
    memory_limit_mb?: number;
    capture_plots?: boolean;
  }) => {
    const response = await apiClient.post('/r-execution/run', {
      code: request.code,
      r_version: request.r_version || '4.3.2',
      mode: request.mode || 'interactive',
      timeout_seconds: request.timeout_seconds || 300,
      memory_limit_mb: request.memory_limit_mb || 2048,
      capture_plots: request.capture_plots !== false,
    });
    return response.data;
  },

  // Get R execution status
  getRExecutionStatus: async (runId: string) => {
    const response = await apiClient.get(`/r-execution/run/${runId}`);
    return response.data;
  },

  // Get R execution result
  getRExecutionResult: async (runId: string) => {
    const response = await apiClient.get(`/r-execution/run/${runId}/result`);
    return response.data;
  },

  // Get console output
  getRConsoleOutput: async (runId: string) => {
    const response = await apiClient.get(`/r-execution/run/${runId}/output/console`);
    return response.data;
  },

  // Download plot
  downloadRPlot: async (runId: string, plotIndex: number) => {
    const response = await apiClient.get(
      `/r-execution/run/${runId}/plots/${plotIndex}`,
      { responseType: 'blob' }
    );
    return response;
  },

  // Download output file
  downloadROutputFile: async (runId: string, filename: string) => {
    const response = await apiClient.get(
      `/r-execution/run/${runId}/download/${filename}`,
      { responseType: 'blob' }
    );
    return response;
  },

  // Cancel R execution
  cancelRExecution: async (runId: string) => {
    const response = await apiClient.delete(`/r-execution/run/${runId}`);
    return response.data;
  },

  // List R versions
  listRVersions: async () => {
    const response = await apiClient.get('/r-execution/versions');
    return response.data;
  },

  // List recent R executions
  listRExecutions: async (limit: number = 20) => {
    const response = await apiClient.get('/r-execution/runs', {
      params: { limit }
    });
    return response.data;
  },

  // Get R execution capabilities (Docker vs Local R)
  getRExecutionCapabilities: async () => {
    const response = await apiClient.get('/r-execution/capabilities');
    return response.data;
  },

  // ============================================================================
  // Code Review & Finalization API Methods
  // ============================================================================

  // Get or create code review session
  getOrCreateReviewSession: async (request: {
    study_id: string;
    dataset: string;
    language: string;
    run_id?: string;
  }) => {
    const response = await apiClient.post('/code-review/session', request);
    return response.data;
  },

  // Get code review session by ID
  getReviewSession: async (sessionId: string) => {
    const response = await apiClient.get(`/code-review/session/${sessionId}`);
    return response.data;
  },

  // Update review session status
  updateReviewSessionStatus: async (
    sessionId: string,
    status: import('../types').CodeReviewStatus
  ) => {
    const response = await apiClient.patch(`/code-review/session/${sessionId}/status`, {
      status,
    });
    return response.data;
  },

  // List review comments
  listReviewComments: async (sessionId: string, statusFilter?: string) => {
    const response = await apiClient.get('/code-review/comments', {
      params: { session_id: sessionId, status_filter: statusFilter },
    });
    return response.data;
  },

  // Create review comment
  createReviewComment: async (request: import('../types').CreateCommentRequest) => {
    const response = await apiClient.post('/code-review/comments', request);
    return response.data;
  },

  // Update review comment
  updateReviewComment: async (
    commentId: string,
    updates: import('../types').UpdateCommentRequest
  ) => {
    const response = await apiClient.patch(`/code-review/comments/${commentId}`, null, {
      params: updates,
    });
    return response.data;
  },

  // Delete review comment (soft delete)
  deleteReviewComment: async (commentId: string) => {
    const response = await apiClient.delete(`/code-review/comments/${commentId}`);
    return response.data;
  },

  // Export review documentation as PDF
  exportReviewPDF: async (request: import('../types').ExportReviewRequest) => {
    const response = await apiClient.post('/code-review/export', request, {
      responseType: 'blob',
    });

    // Trigger download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `code_review_${request.study_id}_${request.dataset}_${request.language}.pdf`
    );
    link.style.display = 'none';
    link.setAttribute('aria-hidden', 'true');
    
    // Try clicking without appending first (works in modern browsers)
    try {
      link.click();
      // Cleanup URL after download starts
      setTimeout(() => {
        try {
          window.URL.revokeObjectURL(url);
        } catch (e) {
          console.debug('URL already revoked:', e);
        }
      }, 1000);
      return response.data;
    } catch (clickError) {
      // Fallback: append to body
    }
    
    // Fallback: append to body, click, then safely remove
    document.body.appendChild(link);
    link.click();
    
    // Safely remove after a delay
    setTimeout(() => {
      try {
        if (link.parentNode === document.body) {
          document.body.removeChild(link);
        } else {
          link.remove();
        }
        window.URL.revokeObjectURL(url);
      } catch (cleanupError) {
        console.debug('Cleanup completed or element already removed:', cleanupError);
        // Try alternative removal method
        try {
          link.remove();
        } catch (e) {
          console.debug('Alternative removal also failed:', e);
        }
      }
    }, 100);

    return response.data;
  },

  // ============================================================================
  // Code Review Session API Methods (New)
  // ============================================================================

  // Create a new code review session
  createCodeReviewSession: async (
    studyId: string,
    adamDataset: string,
    programmingLanguage: string
  ) => {
    const response = await apiClient.post('/code-review/session', {
      study_id: studyId,
      adam_dataset: adamDataset,
      programming_language: programmingLanguage,
    });
    return response.data;
  },

  // Load variable snapshots from Pair Programming into Code Review
  loadVariableSnapshotsForReview: async (
    sessionId: string,
    snippetsData: Record<string, any>
  ) => {
    const response = await apiClient.post(`/code-review/session/${sessionId}/load-snapshots`, {
      session_id: sessionId,
      variables_data: snippetsData,
    });
    return response.data;
  },

  // Get variable snapshots for a code review session
  getVariableSnapshotsForReview: async (
    sessionId: string,
    statusFilter?: string
  ) => {
    const response = await apiClient.get(`/code-review/session/${sessionId}/variables`, {
      params: statusFilter ? { status: statusFilter } : {},
    });
    return response.data;
  },

  // Set variable approval status
  setVariableApprovalStatus: async (
    sessionId: string,
    variableName: string,
    status: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED',
    comments?: string
  ) => {
    const response = await apiClient.post(
      `/code-review/session/${sessionId}/variables/${variableName}/status`,
      {
        status,
        comments,
      }
    );
    return response.data;
  },

  // Add a comment to a variable in code review
  addCodeReviewComment: async (
    sessionId: string,
    variableName: string,
    text: string
  ) => {
    const response = await apiClient.post(`/code-review/session/${sessionId}/comments`, {
      variable_name: variableName,
      text,
    });
    return response.data;
  },

  // Get all comments for a code review session
  getCodeReviewComments: async (
    sessionId: string,
    variableName?: string
  ) => {
    const response = await apiClient.get(`/code-review/session/${sessionId}/comments`, {
      params: variableName ? { variable_name: variableName } : {},
    });
    return response.data;
  },

  // Get complete code review session with all variables and comments
  getCodeReviewSessionWithVariables: async (sessionId: string) => {
    const response = await apiClient.get(`/code-review/session/${sessionId}/full`);
    return response.data;
  },

  // Update overall code review session status
  updateCodeReviewSessionStatus: async (
    sessionId: string,
    status: 'NOT_STARTED' | 'IN_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED'
  ) => {
    const response = await apiClient.put(`/code-review/session/${sessionId}/status`, {
      status,
    });
    return response.data;
  },
};

export default adamApi;
export { adamApi as api };
