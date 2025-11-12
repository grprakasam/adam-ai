/**
 * Progress Tracking Hook
 * Provides progress tracking for long-running operations
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface ProgressState {
  current: number;
  total: number;
  percentage: number;
  message?: string;
  isComplete: boolean;
  isCancelled: boolean;
}

export interface ProgressOptions {
  onComplete?: () => void;
  onProgress?: (state: ProgressState) => void;
  onCancel?: () => void;
}

/**
 * Hook for tracking progress of operations
 */
export function useProgress(total: number = 100, options: ProgressOptions = {}) {
  const [progress, setProgress] = useState<ProgressState>({
    current: 0,
    total,
    percentage: 0,
    message: undefined,
    isComplete: false,
    isCancelled: false,
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const updateProgress = useCallback(
    (current: number, message?: string) => {
      if (!isMountedRef.current) return;

      const percentage = Math.min(100, Math.round((current / total) * 100));
      const isComplete = current >= total;

      const newState: ProgressState = {
        current,
        total,
        percentage,
        message,
        isComplete,
        isCancelled: false,
      };

      setProgress(newState);
      options.onProgress?.(newState);

      if (isComplete) {
        options.onComplete?.();
      }
    },
    [total, options]
  );

  const increment = useCallback(
    (amount: number = 1, message?: string) => {
      setProgress((prev) => {
        const current = prev.current + amount;
        const percentage = Math.min(100, Math.round((current / total) * 100));
        const isComplete = current >= total;

        const newState: ProgressState = {
          current,
          total,
          percentage,
          message: message || prev.message,
          isComplete,
          isCancelled: false,
        };

        if (isMountedRef.current) {
          options.onProgress?.(newState);
          if (isComplete) {
            options.onComplete?.();
          }
        }

        return newState;
      });
    },
    [total, options]
  );

  const reset = useCallback(() => {
    if (!isMountedRef.current) return;

    setProgress({
      current: 0,
      total,
      percentage: 0,
      message: undefined,
      isComplete: false,
      isCancelled: false,
    });
  }, [total]);

  const cancel = useCallback(() => {
    if (!isMountedRef.current) return;

    setProgress((prev) => ({
      ...prev,
      isCancelled: true,
      message: 'Operation cancelled',
    }));

    options.onCancel?.();
  }, [options]);

  const setTotal = useCallback((newTotal: number) => {
    if (!isMountedRef.current) return;

    setProgress((prev) => ({
      ...prev,
      total: newTotal,
      percentage: Math.min(100, Math.round((prev.current / newTotal) * 100)),
    }));
  }, []);

  return {
    progress,
    updateProgress,
    increment,
    reset,
    cancel,
    setTotal,
  };
}

/**
 * Hook for tracking batch operation progress
 * Automatically manages progress for array of operations
 */
export function useBatchProgress<T, R>(
  items: T[],
  operationFn: (item: T, index: number) => Promise<R>,
  options: ProgressOptions = {}
) {
  const { progress, updateProgress, reset, cancel } = useProgress(
    items.length,
    options
  );

  const [results, setResults] = useState<R[]>([]);
  const [errors, setErrors] = useState<Array<{ index: number; error: Error }>>([]);
  const [isRunning, setIsRunning] = useState(false);
  const cancelledRef = useRef(false);

  const execute = useCallback(async () => {
    if (items.length === 0) return;

    setIsRunning(true);
    setResults([]);
    setErrors([]);
    cancelledRef.current = false;
    reset();

    const newResults: R[] = [];
    const newErrors: Array<{ index: number; error: Error }> = [];

    for (let i = 0; i < items.length; i++) {
      if (cancelledRef.current) {
        break;
      }

      try {
        updateProgress(i, `Processing item ${i + 1} of ${items.length}`);
        const result = await operationFn(items[i], i);
        newResults.push(result);
      } catch (error) {
        newErrors.push({
          index: i,
          error: error instanceof Error ? error : new Error('Unknown error'),
        });
      }
    }

    updateProgress(items.length, 'Completed');
    setResults(newResults);
    setErrors(newErrors);
    setIsRunning(false);
  }, [items, operationFn, reset, updateProgress]);

  const cancelExecution = useCallback(() => {
    cancelledRef.current = true;
    cancel();
    setIsRunning(false);
  }, [cancel]);

  return {
    progress,
    results,
    errors,
    isRunning,
    execute,
    cancel: cancelExecution,
    reset,
  };
}

/**
 * Hook for tracking parallel operations progress
 */
export function useParallelProgress<T, R>(
  items: T[],
  operationFn: (item: T, index: number) => Promise<R>,
  options: ProgressOptions & { maxConcurrent?: number } = {}
) {
  const { maxConcurrent = 3 } = options;
  const { progress, updateProgress, reset } = useProgress(items.length, options);

  const [results, setResults] = useState<R[]>([]);
  const [errors, setErrors] = useState<Array<{ index: number; error: Error }>>([]);
  const [isRunning, setIsRunning] = useState(false);

  const execute = useCallback(async () => {
    if (items.length === 0) return;

    setIsRunning(true);
    setResults([]);
    setErrors([]);
    reset();

    let completedCount = 0;
    const newResults: R[] = new Array(items.length);
    const newErrors: Array<{ index: number; error: Error }> = [];

    // Process in batches
    for (let i = 0; i < items.length; i += maxConcurrent) {
      const batch = items.slice(i, Math.min(i + maxConcurrent, items.length));
      const batchPromises = batch.map((item, batchIndex) => {
        const index = i + batchIndex;
        return operationFn(item, index)
          .then((result) => {
            newResults[index] = result;
            completedCount++;
            updateProgress(
              completedCount,
              `Completed ${completedCount} of ${items.length}`
            );
          })
          .catch((error) => {
            newErrors.push({
              index,
              error: error instanceof Error ? error : new Error('Unknown error'),
            });
            completedCount++;
            updateProgress(
              completedCount,
              `Completed ${completedCount} of ${items.length}`
            );
          });
      });

      await Promise.allSettled(batchPromises);
    }

    setResults(newResults.filter(Boolean));
    setErrors(newErrors);
    setIsRunning(false);
  }, [items, operationFn, maxConcurrent, reset, updateProgress]);

  return {
    progress,
    results,
    errors,
    isRunning,
    execute,
    reset,
  };
}

export default {
  useProgress,
  useBatchProgress,
  useParallelProgress,
};
