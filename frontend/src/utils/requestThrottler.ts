/**
 * Request Throttler Utility
 * Throttles and queues API requests to prevent rate limit errors
 */

interface ThrottleConfig {
  maxConcurrent: number;
  delayBetweenRequests: number; // milliseconds
}

interface QueuedRequest<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

/**
 * Request Throttler Class
 * Manages a queue of requests and executes them with throttling
 */
export class RequestThrottler {
  private queue: QueuedRequest<any>[] = [];
  private activeRequests: number = 0;
  private config: ThrottleConfig;
  private lastRequestTime: number = 0;

  constructor(config: Partial<ThrottleConfig> = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent || 3,
      delayBetweenRequests: config.delayBetweenRequests || 100,
    };
  }

  /**
   * Throttle a request function
   * Adds it to queue and processes when available
   */
  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process queued requests with throttling
   */
  private async processQueue() {
    // Check if we can process more requests
    if (
      this.activeRequests >= this.config.maxConcurrent ||
      this.queue.length === 0
    ) {
      return;
    }

    // Check if we need to delay
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.config.delayBetweenRequests) {
      // Wait before processing next request
      setTimeout(
        () => this.processQueue(),
        this.config.delayBetweenRequests - timeSinceLastRequest
      );
      return;
    }

    // Get next request from queue
    const request = this.queue.shift();
    if (!request) return;

    // Execute request
    this.activeRequests++;
    this.lastRequestTime = Date.now();

    try {
      const result = await request.fn();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeRequests--;
      // Process next request in queue
      this.processQueue();
    }
  }

  /**
   * Clear all pending requests
   */
  clear() {
    this.queue.forEach((request) => {
      request.reject(new Error('Request cancelled'));
    });
    this.queue = [];
  }

  /**
   * Get queue statistics
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      maxConcurrent: this.config.maxConcurrent,
    };
  }
}

/**
 * Debounce utility for search/input handlers
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle utility for limiting function execution rate
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Batch requests utility
 * Collects multiple requests and executes them in batches
 */
export class BatchRequestManager<T, R> {
  private batch: T[] = [];
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly batchSize: number;
  private readonly batchDelay: number;
  private readonly executeFn: (items: T[]) => Promise<R[]>;

  constructor(
    executeFn: (items: T[]) => Promise<R[]>,
    batchSize: number = 10,
    batchDelay: number = 500
  ) {
    this.executeFn = executeFn;
    this.batchSize = batchSize;
    this.batchDelay = batchDelay;
  }

  /**
   * Add item to batch
   * Returns promise that resolves when batch is executed
   */
  add(item: T): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      this.batch.push(item);

      // Clear existing timeout
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }

      // Execute immediately if batch is full
      if (this.batch.length >= this.batchSize) {
        this.executeBatch().then(
          (results) => resolve(results[this.batch.length - 1]),
          reject
        );
      } else {
        // Schedule batch execution
        this.batchTimeout = setTimeout(() => {
          const index = this.batch.length - 1;
          this.executeBatch().then(
            (results) => resolve(results[index]),
            reject
          );
        }, this.batchDelay);
      }
    });
  }

  /**
   * Execute current batch
   */
  private async executeBatch(): Promise<R[]> {
    if (this.batch.length === 0) {
      return [];
    }

    const itemsToExecute = [...this.batch];
    this.batch = [];

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    return await this.executeFn(itemsToExecute);
  }

  /**
   * Clear pending batch
   */
  clear() {
    this.batch = [];
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }
}

// Global throttler instances
export const codeGenerationThrottler = new RequestThrottler({
  maxConcurrent: 2,
  delayBetweenRequests: 500,
});

export const fileUploadThrottler = new RequestThrottler({
  maxConcurrent: 1,
  delayBetweenRequests: 1000,
});

export const generalThrottler = new RequestThrottler({
  maxConcurrent: 5,
  delayBetweenRequests: 100,
});

export default {
  RequestThrottler,
  debounce,
  throttle,
  BatchRequestManager,
  codeGenerationThrottler,
  fileUploadThrottler,
  generalThrottler,
};
