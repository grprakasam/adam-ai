import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

type CompareLanguage = 'sas' | 'r' | 'auto';
type ComparisonMode = 'quick' | 'standard' | 'deep';

export interface CodeComparisonRequest {
  code_1: string;
  code_2: string;
  language_1?: CompareLanguage;
  language_2?: CompareLanguage;
  comparison_mode?: ComparisonMode;
  options?: {
    ignore_whitespace?: boolean;
    ignore_comments?: boolean;
    case_sensitive?: boolean;
  };
  context?: {
    study_id?: string;
    dataset?: string;
  };
}

/**
 * Compare two code snippets using the Code Comparer API.
 * Includes basic error mapping to align with the revised plan UX.
 */
export const compareCode = async (request: CodeComparisonRequest) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/v1/code-comparer/analyze`,
      request,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 413) {
      throw new Error('Code too large. Please limit to 2000 lines per file.');
    }
    if (error.response?.status === 400) {
      throw new Error(error.response.data?.detail || 'Invalid input');
    }
    if (error.response?.status === 503) {
      throw new Error('Analysis service temporarily unavailable. Showing basic diff only.');
    }
    throw new Error(error.message || 'Comparison failed');
  }
};

/**
 * Main ADAM AI API object
 */
export const adamApi = {
  compareCode,
  
  // Stub methods - to be implemented
  categorizeSpecification: async (params: any) => {
    console.warn('adamApi.categorizeSpecification not yet implemented');
    return { categorized: [], uncategorized: [] };
  },
  
  categorizeSpecificationFile: async (params: any) => {
    console.warn('adamApi.categorizeSpecificationFile not yet implemented');
    return { categorized: [], uncategorized: [] };
  },
  
  generateCodeBulkStream: async (params: any, onProgress: (progress: any) => void) => {
    console.warn('adamApi.generateCodeBulkStream not yet implemented');
    return { results: [] };
  },
  
  generateProgramWithNotes: async (params: any) => {
    console.warn('adamApi.generateProgramWithNotes not yet implemented');
    return { code: '', notes: '' };
  },
  
  checkSdtmInputs: async (params: any) => {
    console.warn('adamApi.checkSdtmInputs not yet implemented');
    return { status: 'ok', datasets: [] };
  },
  
  generateSdtmBatch: async (params: any) => {
    console.warn('adamApi.generateSdtmBatch not yet implemented');
    return { status: 'pending' };
  },
  
  generateTestData: async (params: any) => {
    console.warn('adamApi.generateTestData not yet implemented');
    return { data: [] };
  },
  
  runTest: async (params: any) => {
    console.warn('adamApi.runTest not yet implemented');
    return { status: 'passed', results: [] };
  },
  
  validateTestOutput: async (params: any) => {
    console.warn('adamApi.validateTestOutput not yet implemented');
    return { valid: true, errors: [] };
  },
  
  executeCodeSnippet: async (params: any) => {
    console.warn('adamApi.executeCodeSnippet not yet implemented');
    return { output: '', error: null };
  },
  
  downloadRPlot: async (runId: string, plotIndex: number) => {
    console.warn('adamApi.downloadRPlot not yet implemented');
    return new Blob();
  },
  
  downloadROutputFile: async (runId: string, filename: string) => {
    console.warn('adamApi.downloadROutputFile not yet implemented');
    return new Blob();
  },
  
  generateCodeSnippet: async (params: any) => {
    console.warn('adamApi.generateCodeSnippet not yet implemented');
    return { code: '', rationale: '' };
  },
  
  uploadTestDataset: async (params: any) => {
    console.warn('adamApi.uploadTestDataset not yet implemented');
    return { success: true };
  },
  
  listTestDatasets: async (projectId: string) => {
    console.warn('adamApi.listTestDatasets not yet implemented');
    return [];
  },
  
  deleteTestDataset: async (datasetId: string) => {
    console.warn('adamApi.deleteTestDataset not yet implemented');
    return { success: true };
  },
  
  generateConsolidatedCodeStream: async (params: any, onProgress: (progress: any) => void) => {
    console.warn('adamApi.generateConsolidatedCodeStream not yet implemented');
    return { code: '' };
  },
  
  checkDockerEnvironment: async () => {
    console.warn('adamApi.checkDockerEnvironment not yet implemented');
    return { available: false };
  },
  
  validateCode: async (params: any) => {
    console.warn('adamApi.validateCode not yet implemented');
    return { valid: true, errors: [] };
  },
  
  setVariableApprovalStatus: async (variable: string, status: string) => {
    console.warn('adamApi.setVariableApprovalStatus not yet implemented');
    return { success: true };
  },
  
  getOpenRouterModels: async () => {
    console.warn('adamApi.getOpenRouterModels not yet implemented');
    return [];
  },
  
  testLLMConnection: async (provider: string, model: string) => {
    console.warn('adamApi.testLLMConnection not yet implemented');
    return { success: true, message: 'Connection test not implemented' };
  },
  
  getRVersions: async () => {
    console.warn('adamApi.getRVersions not yet implemented');
    return ['4.3.0'];
  },
  
  startAdamGeneration: async (params: any) => {
    console.warn('adamApi.startAdamGeneration not yet implemented');
    return { run_id: 'temp-run-id', status: 'pending' };
  },
  
  getAdamGenerationStatus: async (runId: string) => {
    console.warn('adamApi.getAdamGenerationStatus not yet implemented');
    return { status: 'completed', progress: 100 };
  },
  
  getAdamGenerationResult: async (runId: string) => {
    console.warn('adamApi.getAdamGenerationResult not yet implemented');
    return { code: '', dataset: null };
  },
  
  downloadAdamDataset: async (runId: string, format: string) => {
    console.warn('adamApi.downloadAdamDataset not yet implemented');
    return new Blob();
  },
  
  submitAdamGenerationFeedback: async (runId: string, feedback: any) => {
    console.warn('adamApi.submitAdamGenerationFeedback not yet implemented');
    return { success: true };
  },
  
  getSubmissionReadiness: async (params: any) => {
    console.warn('adamApi.getSubmissionReadiness not yet implemented');
    return { overall: 0, components: {}, recommendations: [], last_updated: new Date().toISOString() };
  },
  
  runAllValidations: async (params: any) => {
    console.warn('adamApi.runAllValidations not yet implemented');
    return { status: 'pending', results: [] };
  },
  
  runPreflightValidation: async (params: any) => {
    console.warn('adamApi.runPreflightValidation not yet implemented');
    return { status: 'pending', results: [] };
  },
  
  runCTValidation: async (params: any) => {
    console.warn('adamApi.runCTValidation not yet implemented');
    return { status: 'pending', results: [] };
  },
  
  runP21Validation: async (params: any) => {
    console.warn('adamApi.runP21Validation not yet implemented');
    return { status: 'pending', results: [] };
  },
  
  generateDefineXml: async (params: any) => {
    console.warn('adamApi.generateDefineXml not yet implemented');
    return { status: 'pending', file_path: '' };
  },
  
  generateADRG: async (params: any) => {
    console.warn('adamApi.generateADRG not yet implemented');
    return { status: 'pending', file_path: '' };
  },
  
  generateSDRG: async (params: any) => {
    console.warn('adamApi.generateSDRG not yet implemented');
    return { status: 'pending', file_path: '' };
  },
  
  createECTDPackage: async (params: any) => {
    console.warn('adamApi.createECTDPackage not yet implemented');
    return { status: 'pending', package_path: '' };
  },
  
  getOrCreateReviewSession: async (params: any) => {
    console.warn('adamApi.getOrCreateReviewSession not yet implemented');
    return { id: 'temp-session', status: 'in_progress', created_at: new Date().toISOString() };
  },
  
  listReviewComments: async (sessionId: string) => {
    console.warn('adamApi.listReviewComments not yet implemented');
    return [];
  },
  
  updateReviewSessionStatus: async (sessionId: string, status: string) => {
    console.warn('adamApi.updateReviewSessionStatus not yet implemented');
    return { id: sessionId, status };
  },
  
  createReviewComment: async (params: any) => {
    console.warn('adamApi.createReviewComment not yet implemented');
    return { id: 'temp-comment', ...params, created_at: new Date().toISOString() };
  },
  
  exportReviewPDF: async (params: any) => {
    console.warn('adamApi.exportReviewPDF not yet implemented');
    return { status: 'pending', file_path: '' };
  },
};
