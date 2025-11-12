/**
 * Custom Hook for Async State Management with Cleanup
 * Provides automatic cleanup and error handling for async operations
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface UseAsyncStateOptions {
  onError?: (error: Error) => void;
  onSuccess?: () => void;
  cleanupOnUnmount?: boolean;
}

/**
 * Hook for managing async state with automatic cleanup
 *
 * @example
 * const { data, loading, error, execute, reset } = useAsyncState(
 *   async () => await api.fetchData(),
 *   { cleanupOnUnmount: true }
 * );
 */
export function useAsyncState<T>(
  asyncFunction: () => Promise<T>,
  options: UseAsyncStateOptions = {}
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (options.cleanupOnUnmount && abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [options.cleanupOnUnmount]);

  const execute = useCallback(async () => {
    // Create new abort controller for this execution
    abortControllerRef.current = new AbortController();

    if (!isMountedRef.current) return;

    setState({ data: null, loading: true, error: null });

    try {
      const result = await asyncFunction();

      if (isMountedRef.current) {
        setState({ data: result, loading: false, error: null });
        options.onSuccess?.();
      }
    } catch (error) {
      if (isMountedRef.current) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        setState({ data: null, loading: false, error: err });
        options.onError?.(err);
      }
    }
  }, [asyncFunction, options]);

  const reset = useCallback(() => {
    if (isMountedRef.current) {
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setState({ data: null, loading: false, error: null });
    }
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

/**
 * Hook for managing multiple async operations
 * Provides parallel execution and cleanup
 */
export function useMultiAsyncState<T extends Record<string, () => Promise<any>>>(
  operations: T,
  options: UseAsyncStateOptions = {}
) {
  type Keys = keyof T;
  type States = {
    [K in Keys]: AsyncState<Awaited<ReturnType<T[K]>>>;
  };

  const initialStates = Object.keys(operations).reduce((acc, key) => {
    acc[key as Keys] = { data: null, loading: false, error: null };
    return acc;
  }, {} as States);

  const [states, setStates] = useState<States>(initialStates);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const executeAll = useCallback(async () => {
    if (!isMountedRef.current) return;

    // Set all to loading
    const loadingStates = Object.keys(operations).reduce((acc, key) => {
      acc[key as Keys] = { data: null, loading: true, error: null };
      return acc;
    }, {} as States);

    setStates(loadingStates);

    // Execute all operations in parallel
    await Promise.allSettled(
      Object.entries(operations).map(async ([key, operation]) => {
        try {
          const result = await operation();

          if (isMountedRef.current) {
            setStates((prev) => ({
              ...prev,
              [key]: { data: result, loading: false, error: null },
            }));
          }
        } catch (error) {
          if (isMountedRef.current) {
            const err = error instanceof Error ? error : new Error('Unknown error');
            setStates((prev) => ({
              ...prev,
              [key]: { data: null, loading: false, error: err },
            }));
            options.onError?.(err);
          }
        }
      })
    );
  }, [operations, options]);

  const reset = useCallback(() => {
    if (isMountedRef.current) {
      setStates(initialStates);
    }
  }, [initialStates]);

  const resetKey = useCallback((key: Keys) => {
    if (isMountedRef.current) {
      setStates((prev) => ({
        ...prev,
        [key]: { data: null, loading: false, error: null },
      }));
    }
  }, []);

  return {
    states,
    executeAll,
    reset,
    resetKey,
  };
}

/**
 * Hook for managing optimistic updates with rollback
 */
export function useOptimisticUpdate<T>(
  initialData: T,
  updateFn: (data: T) => Promise<T>,
  options: UseAsyncStateOptions = {}
) {
  const [data, setData] = useState<T>(initialData);
  const [previousData, setPreviousData] = useState<T>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const update = useCallback(
    async (optimisticData: T) => {
      if (!isMountedRef.current) return;

      // Store previous data for rollback
      setPreviousData(data);

      // Apply optimistic update
      setData(optimisticData);
      setLoading(true);
      setError(null);

      try {
        const result = await updateFn(optimisticData);

        if (isMountedRef.current) {
          setData(result);
          setLoading(false);
          options.onSuccess?.();
        }
      } catch (err) {
        if (isMountedRef.current) {
          // Rollback to previous data
          setData(previousData);
          const error = err instanceof Error ? err : new Error('Update failed');
          setError(error);
          setLoading(false);
          options.onError?.(error);
        }
      }
    },
    [data, previousData, updateFn, options]
  );

  const reset = useCallback(() => {
    if (isMountedRef.current) {
      setData(initialData);
      setPreviousData(initialData);
      setLoading(false);
      setError(null);
    }
  }, [initialData]);

  return {
    data,
    loading,
    error,
    update,
    reset,
  };
}

export default {
  useAsyncState,
  useMultiAsyncState,
  useOptimisticUpdate,
};
