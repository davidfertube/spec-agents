/**
 * Timeout Utility for Async Operations
 * ====================================
 *
 * This module provides utilities for wrapping promises with timeouts.
 * This is critical for preventing hung API calls from consuming server resources.
 *
 * Without timeouts, a single slow LLM call could hang indefinitely,
 * tying up a serverless function and costing money.
 */

/**
 * Custom error class for timeout errors
 * Allows us to distinguish timeout errors from other errors
 */
export class TimeoutError extends Error {
  constructor(message: string, public readonly timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Wrap a promise with a timeout
 *
 * If the promise doesn't resolve within the timeout period,
 * it will be rejected with a TimeoutError.
 *
 * The timeout is automatically cleared when the promise resolves or rejects,
 * preventing memory leaks.
 *
 * @param promise - The promise to wrap with a timeout
 * @param timeoutMs - Timeout in milliseconds
 * @param operationName - Human-readable name for error messages (helps with debugging)
 * @returns The result of the promise if it completes in time
 * @throws TimeoutError if the timeout expires
 * @throws The original error if the promise rejects
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   fetch('https://api.example.com/data'),
 *   5000,
 *   'API fetch'
 * );
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string = 'Operation'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  // Create a promise that rejects after the timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(
        `${operationName} timed out after ${timeoutMs}ms`,
        timeoutMs
      ));
    }, timeoutMs);
  });

  try {
    // Race the original promise against the timeout
    // Whichever completes first wins
    const result = await Promise.race([promise, timeoutPromise]);

    // Clear the timeout to prevent memory leaks
    clearTimeout(timeoutId!);

    return result;
  } catch (error) {
    // Clear the timeout even if there's an error
    clearTimeout(timeoutId!);

    // Re-throw the error (could be timeout or original error)
    throw error;
  }
}

/**
 * Common timeout values used throughout the application
 *
 * These are calibrated based on:
 * - LLM_GENERATION: Typical Gemini response time is 3-10s, allow 30s for safety
 * - EMBEDDING_SINGLE: Single embedding typically takes 1-3s, allow 10s
 * - DATABASE_QUERY: Simple queries should be <1s, allow 5s for complex ones
 * - FILE_UPLOAD: Large PDFs (50MB) can take time, allow 60s
 */
export const TIMEOUTS = {
  /** Timeout for LLM response generation (30 seconds) */
  LLM_GENERATION: 30000,

  /** Timeout for generating a single embedding (10 seconds) */
  EMBEDDING_SINGLE: 10000,

  /** Timeout for database queries (5 seconds) */
  DATABASE_QUERY: 5000,

  /** Timeout for vector similarity search (5 seconds) */
  VECTOR_SEARCH: 5000,

  /** Timeout for file uploads (60 seconds) */
  FILE_UPLOAD: 60000,
} as const;

/**
 * Helper to create multiple timeout wrappers for batch operations
 *
 * Useful when you need to process multiple items with individual timeouts
 *
 * @example
 * ```typescript
 * const embeddings = await Promise.all(
 *   chunks.map(chunk =>
 *     withTimeout(
 *       generateEmbedding(chunk),
 *       TIMEOUTS.EMBEDDING_SINGLE,
 *       'Generate embedding'
 *     )
 *   )
 * );
 * ```
 */
export function withBatchTimeout<T>(
  promises: Promise<T>[],
  timeoutMs: number,
  operationName: string = 'Batch operation'
): Promise<T[]> {
  return Promise.all(
    promises.map((p, index) =>
      withTimeout(p, timeoutMs, `${operationName} #${index + 1}`)
    )
  );
}
