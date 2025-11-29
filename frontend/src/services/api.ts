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

// ============================================================================
// Study Chatbot API
// ============================================================================

export interface StudyChatbotUploadResponse {
  session_id: string;
  files_uploaded: number;
  files: Array<{
    filename: string;
    path: string;
    size: number;
    type: string;
  }>;
}

export interface KnowledgeBaseRequest {
  session_id: string;
  file_paths: string[];
}

export interface KnowledgeBaseResponse {
  session_id: string;
  study_id?: string;
  phase?: string;
  subject_count?: number;
  primary_endpoint?: string;
  insights: string[];
  files_processed: number;
  processing_time_ms: number;
  status: 'success' | 'partial' | 'failed';
  error_message?: string;
}

export interface SuggestedQuestion {
  id: string;
  question: string;
  category: string;
  priority: number;
}

export interface SuggestedQuestionsResponse {
  session_id: string;
  questions: SuggestedQuestion[];
}

export interface ChatRequest {
  session_id: string;
  message: string;
  response_style?: 'concise' | 'detailed' | 'technical';
  language?: string;
  show_sources?: boolean;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sources?: string[];
}

export interface ChatResponse {
  session_id: string;
  message: ChatMessage;
  processing_time_ms: number;
  tokens_used?: number;
}

/**
 * Upload study documents for chatbot knowledge base
 */
export const uploadStudyFiles = async (files: File[]): Promise<StudyChatbotUploadResponse> => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const response = await axios.post(
    `${API_BASE_URL}/api/v1/study-chatbot/upload`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return response.data;
};

/**
 * Create knowledge base from uploaded files
 */
export const createKnowledgeBase = async (request: KnowledgeBaseRequest): Promise<KnowledgeBaseResponse> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/v1/study-chatbot/knowledge-base`,
    request
  );
  return response.data;
};

/**
 * Get auto-generated suggested questions
 */
export const getSuggestedQuestions = async (sessionId: string): Promise<SuggestedQuestionsResponse> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/v1/study-chatbot/suggested-questions/${sessionId}`
  );
  return response.data;
};

/**
 * Chat with the study assistant
 */
export const sendChatMessage = async (request: ChatRequest): Promise<ChatResponse> => {
  const response = await axios.post(
    `${API_BASE_URL}/api/v1/study-chatbot/chat`,
    request
  );
  return response.data;
};

/**
 * Delete a chatbot session
 */
export const deleteStudyChatSession = async (sessionId: string): Promise<{ status: string; message: string }> => {
  const response = await axios.delete(
    `${API_BASE_URL}/api/v1/study-chatbot/session/${sessionId}`
  );
  return response.data;
};

// ============================================================================
// ADaM Analytics API
// ============================================================================

export type AnalyticsRole =
  | 'developerStatistician'
  | 'clinician'
  | 'standardsProgrammer'
  | 'studyProgrammer'
  | 'clinicalDataManager'
  | 'dataScientist';

export interface AdamAnalyticsDatasetSummary {
  name: string;
  records: number;
  subjects: number;
  variables: number;
  domain_type: 'ADSL' | 'BDS' | 'OCCDS' | 'Other';
  status: 'Analyzed' | 'Pending';
}

export interface AdamAnalyticsOverview {
  study_id: string;
  datasets: AdamAnalyticsDatasetSummary[];
}

export interface AdamAnalyticsInsightItem {
  title: string;
  text: string;
  category:
    | 'about'
    | 'variables'
    | 'insights'
    | 'trends'
    | 'outliers'
    | 'correlations'
    | 'patterns'
    | 'anomalies'
    | 'recommendations';
  citations: string[];
}

export interface AdamAnalyticsRoleInsights {
  role: string;
  dataset: string;
  items: AdamAnalyticsInsightItem[];
}

export interface AdamAnalyticsUploadResponse {
  session_id: string;
  datasets: AdamAnalyticsDatasetSummary[];
  files: string[];
}

export interface AdamAnalyticsTrendPoint {
  x: number | string;
  y: number;
}

export interface AdamAnalyticsTrendSeries {
  label: string;
  points: AdamAnalyticsTrendPoint[];
}

export interface AdamAnalyticsTrendResponse {
  dataset: string;
  series: AdamAnalyticsTrendSeries[];
}

export interface AdamAnalyticsOutlierRecord {
  variable: string;
  value: number;
  z_score: number;
  index: number;
}

export interface AdamAnalyticsOutlierVariableSummary {
  variable: string;
  total_outliers: number;
  examples: AdamAnalyticsOutlierRecord[];
}

export interface AdamAnalyticsOutlierResponse {
  dataset: string;
  variables: AdamAnalyticsOutlierVariableSummary[];
}

export interface AdamAnalyticsCorrelationPair {
  var_x: string;
  var_y: string;
  coefficient: number;
}

export interface AdamAnalyticsCorrelationResponse {
  dataset: string;
  pairs: AdamAnalyticsCorrelationPair[];
}

export const uploadAdamAnalyticsFiles = async (
  files: File[],
): Promise<AdamAnalyticsUploadResponse> => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const response = await axios.post(
    `${API_BASE_URL}/api/v1/adam-analytics/upload`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return response.data;
};

export const getAdamAnalyticsOverview = async (
  sessionId: string,
): Promise<AdamAnalyticsOverview> => {
  const response = await axios.get(`${API_BASE_URL}/api/v1/adam-analytics/overview`, {
    params: { session_id: sessionId },
  });
  return response.data;
};

export const getAdamAnalyticsRoleInsights = async (
  datasetName: string,
  role: AnalyticsRole,
): Promise<AdamAnalyticsRoleInsights> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/v1/adam-analytics/insights/${encodeURIComponent(datasetName)}`,
    { params: { role } }
  );
  return response.data;
};

export const getAdamAnalyticsTrendSeries = async (
  datasetName: string,
  sessionId: string,
): Promise<AdamAnalyticsTrendResponse> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/v1/adam-analytics/trend-series/${encodeURIComponent(datasetName)}`,
    { params: { session_id: sessionId } }
  );
  return response.data;
};

export const getAdamAnalyticsOutliers = async (
  datasetName: string,
  sessionId: string,
): Promise<AdamAnalyticsOutlierResponse> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/v1/adam-analytics/outliers/${encodeURIComponent(datasetName)}`,
    { params: { session_id: sessionId } }
  );
  return response.data;
};

export const getAdamAnalyticsCorrelations = async (
  datasetName: string,
  sessionId: string,
): Promise<AdamAnalyticsCorrelationResponse> => {
  const response = await axios.get(
    `${API_BASE_URL}/api/v1/adam-analytics/correlations/${encodeURIComponent(datasetName)}`,
    { params: { session_id: sessionId } }
  );
  return response.data;
};

/**
 * Main ADAM AI API object
 */
export const adamApi = {
  compareCode,
  getAdamAnalyticsOverview,
  getAdamAnalyticsRoleInsights,
  uploadAdamAnalyticsFiles,
  getAdamAnalyticsTrendSeries,
  getAdamAnalyticsOutliers,
  getAdamAnalyticsCorrelations,
  
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
