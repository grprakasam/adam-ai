/**
 * Custom Hook for API Requests with Cancellation
 * Automatically cancels requests when component unmounts
 */

import { useEffect, useRef, useCallback } from 'react';
import axios, { CancelTokenSource } from 'axios';

export function useApiRequest() {
  const cancelTokensRef = useRef<CancelTokenSource[]>([]);

  /**
   * Create a cancellable API request
   */
  const createCancellableRequest = useCallback(<T extends any>(
    requestFn: (cancelToken: CancelTokenSource) => Promise<T>
  ): Promise<T> => {
    const cancelToken = axios.CancelToken.source();
    cancelTokensRef.current.push(cancelToken);

    const promise = requestFn(cancelToken);

    // Remove from array when completed
    promise
      .finally(() => {
        cancelTokensRef.current = cancelTokensRef.current.filter(
          token => token !== cancelToken
        );
      });

    return promise;
  }, []);

  /**
   * Cancel all pending requests
   */
  const cancelAllRequests = useCallback(() => {
    cancelTokensRef.current.forEach(token => {
      token.cancel('Request cancelled by user or component unmount');
    });
    cancelTokensRef.current = [];
  }, []);

  // Cancel all requests on unmount
  useEffect(() => {
    return () => {
      cancelAllRequests();
    };
  }, [cancelAllRequests]);

  return {
    createCancellableRequest,
    cancelAllRequests
  };
}

/**
 * Custom Hook for Abortable Fetch Requests
 * Uses AbortController for fetch API
 */
export function useAbortableRequest() {
  const abortControllersRef = useRef<AbortController[]>([]);

  /**
   * Create an abortable request
   */
  const createAbortableRequest = useCallback(<T extends any>(
    requestFn: (signal: AbortSignal) => Promise<T>
  ): Promise<T> => {
    const controller = new AbortController();
    abortControllersRef.current.push(controller);

    const promise = requestFn(controller.signal);

    // Remove from array when completed
    promise
      .finally(() => {
        abortControllersRef.current = abortControllersRef.current.filter(
          ctrl => ctrl !== controller
        );
      });

    return promise;
  }, []);

  /**
   * Abort all pending requests
   */
  const abortAllRequests = useCallback(() => {
    abortControllersRef.current.forEach(controller => {
      controller.abort();
    });
    abortControllersRef.current = [];
  }, []);

  // Abort all requests on unmount
  useEffect(() => {
    return () => {
      abortAllRequests();
    };
  }, [abortAllRequests]);

  return {
    createAbortableRequest,
    abortAllRequests
  };
}
