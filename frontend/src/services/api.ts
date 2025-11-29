import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

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

// Export as 'api' for backward compatibility
export const api = adamApi;
