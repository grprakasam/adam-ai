/**
 * Performance Monitoring Service
 * Tracks API performance and provides batch processing
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface CacheStats {
  size: number;
  max_size: number;
  hits: number;
  misses: number;
  total_requests: number;
  hit_rate: number;
}

export interface BatchJobProgress {
  job_id: string;
  status: string;
  progress: number;
  total: number;
  completed: number;
  failed: number;
  processing: number;
  pending: number;
}

export interface BatchJobRequest {
  variables: string[];
  operation: 'generate' | 'validate' | 'categorize';
  language: 'R' | 'SAS';
  spec?: string;
}

export interface PerformanceStats {
  cache: CacheStats;
  batch_processor: {
    max_concurrent: number;
    active_jobs: number;
    total_jobs: number;
  };
  system: {
    max_concurrent_jobs: number;
    cache_max_size: number;
  };
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Get cache statistics
 */
export const getCacheStats = async (): Promise<CacheStats> => {
  try {
    const response = await axios.get<CacheStats>(
      `${API_BASE_URL}/api/v1/performance/cache/stats`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to get cache stats');
  }
};

/**
 * Clear all cached data (admin only)
 */
export const clearCache = async (): Promise<void> => {
  try {
    await axios.post(
      `${API_BASE_URL}/api/v1/performance/cache/clear`,
      {},
      { headers: getAuthHeaders() }
    );
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to clear cache');
  }
};

/**
 * Cleanup expired cache entries
 */
export const cleanupExpiredCache = async (): Promise<{ removed_count: number }> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/v1/performance/cache/cleanup`,
      {},
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to cleanup cache');
  }
};

/**
 * Create batch processing job
 */
export const createBatchJob = async (
  request: BatchJobRequest
): Promise<{ job_id: string; status: string; item_count: number }> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/v1/performance/batch/create`,
      request,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to create batch job');
  }
};

/**
 * Get batch job progress
 */
export const getBatchJobProgress = async (jobId: string): Promise<BatchJobProgress> => {
  try {
    const response = await axios.get<BatchJobProgress>(
      `${API_BASE_URL}/api/v1/performance/batch/${jobId}/progress`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to get batch progress');
  }
};

/**
 * Get batch job results
 */
export const getBatchJobResults = async (jobId: string): Promise<any> => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/v1/performance/batch/${jobId}/results`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to get batch results');
  }
};

/**
 * Cancel batch job
 */
export const cancelBatchJob = async (jobId: string): Promise<void> => {
  try {
    await axios.delete(
      `${API_BASE_URL}/api/v1/performance/batch/${jobId}`,
      { headers: getAuthHeaders() }
    );
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to cancel batch job');
  }
};

/**
 * Get overall performance statistics
 */
export const getPerformanceStats = async (): Promise<PerformanceStats> => {
  try {
    const response = await axios.get<PerformanceStats>(
      `${API_BASE_URL}/api/v1/performance/stats`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to get performance stats');
  }
};

/**
 * Poll batch job until complete
 */
export const pollBatchJob = async (
  jobId: string,
  onProgress?: (progress: BatchJobProgress) => void,
  intervalMs: number = 2000
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const progress = await getBatchJobProgress(jobId);
        
        if (onProgress) {
          onProgress(progress);
        }
        
        // Check if completed or failed
        if (progress.status === 'completed' || progress.status === 'failed') {
          clearInterval(interval);
          
          // Get final results
          const results = await getBatchJobResults(jobId);
          resolve(results);
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, intervalMs);
  });
};

/**
 * Format cache hit rate for display
 */
export const formatHitRate = (hitRate: number): string => {
  return `${hitRate.toFixed(1)}%`;
};

/**
 * Format progress percentage
 */
export const formatProgress = (progress: number): string => {
  return `${Math.round(progress)}%`;
};

/**
 * Get progress color based on value
 */
export const getProgressColor = (progress: number): string => {
  if (progress < 33) return '#ff4d4f';  // red
  if (progress < 66) return '#faad14';  // orange
  return '#52c41a';  // green
};

/**
 * Get status color
 */
export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'processing':
      return 'processing';
    case 'failed':
      return 'error';
    case 'pending':
      return 'default';
    case 'cancelled':
      return 'warning';
    default:
      return 'default';
  }
};

export default {
  getCacheStats,
  clearCache,
  cleanupExpiredCache,
  createBatchJob,
  getBatchJobProgress,
  getBatchJobResults,
  cancelBatchJob,
  getPerformanceStats,
  pollBatchJob,
  formatHitRate,
  formatProgress,
  getProgressColor,
  getStatusColor
};
