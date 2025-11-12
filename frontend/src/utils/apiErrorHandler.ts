/**
 * API Error Handler Utilities
 * Centralized error handling for API calls
 */

import { message } from 'antd';
import axios, { AxiosError } from 'axios';

export interface APIError {
  message: string;
  status?: number;
  details?: any;
  isNetworkError: boolean;
  isTimeout: boolean;
  isServerError: boolean;
  isClientError: boolean;
}

/**
 * Parse and standardize API errors
 */
export function parseAPIError(error: unknown): APIError {
  // Axios error
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;

    // Network error (no response)
    if (!axiosError.response) {
      return {
        message: axiosError.code === 'ECONNABORTED'
          ? 'Request timeout. Please try again.'
          : 'Network error. Please check your connection.',
        isNetworkError: true,
        isTimeout: axiosError.code === 'ECONNABORTED',
        isServerError: false,
        isClientError: false,
      };
    }

    // Server responded with error
    const status = axiosError.response.status;
    const data = axiosError.response.data;

    let message = 'An error occurred. Please try again.';

    // Extract error message from response
    if (data?.message) {
      message = data.message;
    } else if (data?.detail) {
      message = data.detail;
    } else if (data?.error) {
      message = typeof data.error === 'string' ? data.error : 'An error occurred';
    }

    return {
      message,
      status,
      details: data?.details || data?.errors,
      isNetworkError: false,
      isTimeout: false,
      isServerError: status >= 500,
      isClientError: status >= 400 && status < 500,
    };
  }

  // Regular Error object
  if (error instanceof Error) {
    return {
      message: error.message,
      isNetworkError: false,
      isTimeout: false,
      isServerError: false,
      isClientError: false,
    };
  }

  // Unknown error
  return {
    message: 'An unexpected error occurred',
    isNetworkError: false,
    isTimeout: false,
    isServerError: false,
    isClientError: false,
  };
}

/**
 * Handle API error with user notification
 */
export function handleAPIError(error: unknown, customMessage?: string): APIError {
  const parsedError = parseAPIError(error);

  // Show user-friendly message
  const displayMessage = customMessage || parsedError.message;

  if (parsedError.isNetworkError) {
    message.error({
      content: displayMessage,
      duration: 5,
      key: 'network-error',
    });
  } else if (parsedError.isTimeout) {
    message.warning({
      content: displayMessage,
      duration: 4,
      key: 'timeout-error',
    });
  } else if (parsedError.isServerError) {
    message.error({
      content: displayMessage + ' Please try again later.',
      duration: 5,
      key: 'server-error',
    });
  } else if (parsedError.isClientError) {
    message.warning({
      content: displayMessage,
      duration: 4,
      key: 'client-error',
    });
  } else {
    message.error({
      content: displayMessage,
      duration: 4,
      key: 'general-error',
    });
  }

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('API Error:', parsedError);
  }

  return parsedError;
}

/**
 * Get user-friendly error message based on status code
 */
export function getErrorMessageByStatus(status?: number): string {
  if (!status) return 'An error occurred';

  switch (status) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      return 'Unauthorized. Please log in again.';
    case 403:
      return 'Access forbidden. You don\'t have permission.';
    case 404:
      return 'Resource not found.';
    case 408:
      return 'Request timeout. Please try again.';
    case 422:
      return 'Validation error. Please check your input.';
    case 429:
      return 'Too many requests. Please wait and try again.';
    case 500:
      return 'Server error. Please try again later.';
    case 502:
      return 'Bad gateway. The server is temporarily unavailable.';
    case 503:
      return 'Service unavailable. Please try again later.';
    case 504:
      return 'Gateway timeout. The server took too long to respond.';
    default:
      if (status >= 500) {
        return 'Server error. Please try again later.';
      } else if (status >= 400) {
        return 'Request error. Please check your input.';
      }
      return 'An error occurred. Please try again.';
  }
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const parsedError = parseAPIError(error);

      // Don't retry client errors (4xx)
      if (parsedError.isClientError) {
        throw error;
      }

      // Don't retry on last attempt
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.log(`Retry attempt ${i + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Check if error is recoverable (can be retried)
 */
export function isRecoverableError(error: unknown): boolean {
  const parsedError = parseAPIError(error);
  return parsedError.isNetworkError ||
         parsedError.isTimeout ||
         parsedError.isServerError;
}
