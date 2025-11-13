import axios, { AxiosError } from 'axios';
import type { GenerationRequest, GenerationResponse, CategorizationResult, CodeSnippetRequest, CodeSnippetResponse } from '../types';
import { codeGenerationThrottler, fileUploadThrottler } from '../utils/requestThrottler';

const getApiBaseUrl = () => {
  const envUrl =
    typeof import.meta !== 'undefined'
      ? (((import.meta as any).env?.VITE_API_BASE_URL ?? '').trim())
      : '';

  if (envUrl) {
    return envUrl;
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    const isViteDevServer = port === '5173';
    if (!isViteDevServer) {
      const normalizedProtocol =
        protocol && protocol.startsWith('http') ? protocol : 'http:';
      const targetHost = hostname || 'localhost';
      return `${normalizedProtocol}//${targetHost}:8000/api/v1`;
    }
  }

  return '/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 seconds default timeout
});

// Request interceptor for adding common headers
apiClient.interceptors.request.use(
  (config) => {
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
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const adamApi = {
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
  validateCode: async (code: string, language: string) => {
    const response = await apiClient.post('/validation/validate', { 
      code, 
      language,
      check_style: true 
    });
    return response.data;
  },

  // LLM defaults
  getLLMDefaults: async () => {
    const response = await apiClient.get('/llm/defaults');
    return response.data;
  },

  // Categorize specification variables
  categorizeSpecification: async (specFilePath: string, datasetType: string = 'ADSL'): Promise<CategorizationResult> => {
    return await fileUploadThrottler.throttle(async () => {
      const response = await apiClient.post('/specification/categorize-path', {
        spec_file_path: specFilePath,
        dataset_type: datasetType
      });
      return response.data;
    });
  },

  // Categorize specification by file upload
  categorizeSpecificationFile: async (file: File, datasetType: string = 'ADSL'): Promise<CategorizationResult> => {
    return await fileUploadThrottler.throttle(async () => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dataset_type', datasetType);

      const response = await apiClient.post('/specification/categorize', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
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
      
      // Use fetch with EventSource fallback
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })
        .then(async (response) => {
          if (!response.ok) {
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
              } else if (line.startsWith('event: result')) {
                continue; // Event type line
              } else if (line.startsWith('event: error')) {
                continue; // Event type line
              } else if (line.startsWith('data: ')) {
                const data = line.slice(6); // Remove 'data: ' prefix
                try {
                  const parsed = JSON.parse(data);
                  
                  // Check if this is a progress update
                  if (parsed.status) {
                    onProgress(parsed);
                  }
                  // Check if this is the result array
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
  }
};

export default adamApi;
export { adamApi as api };
