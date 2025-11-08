import axios from 'axios';
import type { GenerationRequest, GenerationResponse } from '../types';

const API_BASE_URL = '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
    const response = await apiClient.post('/validate', { code, language });
    return response.data;
  },

  // LLM defaults
  getLLMDefaults: async () => {
    const response = await apiClient.get('/llm/defaults');
    return response.data;
  }
};

export default adamApi;
