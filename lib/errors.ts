/**
 * Safe Error Handling Utilities
 * ==============================
 *
 * This module provides standardized error handling for API routes.
 * It ensures that internal error details are NEVER leaked to clients,
 * which could expose:
 * - API keys
 * - Database schemas
 * - File paths
 * - Stack traces
 *
 * All errors are:
 * 1. Logged server-side with full details
 * 2. Returned to client with safe, generic messages
 */

// ============================================
// Error Codes
// ============================================

/**
 * Standardized error codes for client-facing errors
 * These provide structure without revealing internals
 */
export const ERROR_CODES = {
  /** Request validation failed (bad input) */
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  /** Requested resource was not found */
  NOT_FOUND: 'NOT_FOUND',

  /** Authentication is required */
  UNAUTHORIZED: 'UNAUTHORIZED',

  /** User is authenticated but not allowed */
  FORBIDDEN: 'FORBIDDEN',

  /** Too many requests (rate limited) */
  RATE_LIMITED: 'RATE_LIMITED',

  /** Something went wrong on our end */
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  /** External service is unavailable */
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  /** Request took too long */
  TIMEOUT: 'TIMEOUT',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

// ============================================
// Safe Error Messages
// ============================================

/**
 * Client-safe error messages for each error code
 * These are generic enough to not reveal any internals
 */
const SAFE_ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Invalid request. Please check your input and try again.',
  NOT_FOUND: 'The requested resource was not found.',
  UNAUTHORIZED: 'Authentication is required to access this resource.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
  SERVICE_UNAVAILABLE: 'Service is temporarily unavailable. Please try again later.',
  TIMEOUT: 'The request took too long. Please try again.',
};

/**
 * HTTP status codes for each error type
 */
const ERROR_STATUS_CODES: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 504,
};

// ============================================
// Error Response Types
// ============================================

/**
 * Structure of error response sent to clients
 */
export interface SafeErrorResponse {
  /** Human-readable error message (safe to show) */
  error: string;
  /** Error code for programmatic handling */
  code: ErrorCode;
}

// ============================================
// Error Handling Functions
// ============================================

/**
 * Create a safe error response for the client
 *
 * This function:
 * 1. Logs the full error details server-side
 * 2. Returns a sanitized message to the client
 *
 * @param error - The caught error (any type)
 * @param code - Error code (defaults to INTERNAL_ERROR)
 * @param context - Optional context for logging (e.g., "Chat API")
 * @returns Safe error response object
 *
 * @example
 * ```typescript
 * try {
 *   // ... some operation
 * } catch (error) {
 *   const safeError = createSafeErrorResponse(error, 'INTERNAL_ERROR', 'Chat API');
 *   return NextResponse.json(safeError, { status: getErrorStatusCode('INTERNAL_ERROR') });
 * }
 * ```
 */
export function createSafeErrorResponse(
  error: unknown,
  code: ErrorCode = 'INTERNAL_ERROR',
  context?: string
): SafeErrorResponse {
  // Build a detailed log message for server-side debugging
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` [${context}]` : '';

  // Log full error details server-side
  console.error(
    `[${timestamp}] ERROR${contextStr} [${code}]:`,
    error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack,
    } : error
  );

  // Return sanitized response to client
  return {
    error: SAFE_ERROR_MESSAGES[code],
    code,
  };
}

/**
 * Get the HTTP status code for an error code
 *
 * @param code - The error code
 * @returns HTTP status code
 */
export function getErrorStatusCode(code: ErrorCode): number {
  return ERROR_STATUS_CODES[code] || 500;
}

/**
 * Categorize an unknown error into an appropriate error code
 *
 * This function examines the error and determines the most
 * appropriate error code to return to the client.
 *
 * IMPORTANT: This function inspects error messages for categorization,
 * but the actual messages are NEVER sent to the client.
 *
 * @param error - The caught error
 * @returns Appropriate error code
 */
export function categorizeError(error: unknown): ErrorCode {
  // Check if it's our custom TimeoutError
  if (error instanceof Error && error.name === 'TimeoutError') {
    return 'TIMEOUT';
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // API key issues - mask as service unavailable
    if (message.includes('api key') || message.includes('api_key') || message.includes('apikey')) {
      return 'SERVICE_UNAVAILABLE';
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('quota') || message.includes('too many')) {
      return 'RATE_LIMITED';
    }

    // Not found errors
    if (message.includes('not found') || message.includes('404') || message.includes('does not exist')) {
      return 'NOT_FOUND';
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out') || message.includes('econnreset')) {
      return 'TIMEOUT';
    }

    // Connection errors
    if (message.includes('econnrefused') || message.includes('network') || message.includes('fetch failed')) {
      return 'SERVICE_UNAVAILABLE';
    }

    // Authentication errors
    if (message.includes('unauthorized') || message.includes('authentication') || message.includes('401')) {
      return 'UNAUTHORIZED';
    }

    // Validation errors
    if (message.includes('invalid') || message.includes('validation') || message.includes('required')) {
      return 'VALIDATION_ERROR';
    }
  }

  // Default to internal error for unknown error types
  return 'INTERNAL_ERROR';
}

/**
 * Convenience function to create and return error response
 *
 * @param error - The caught error
 * @param context - Context for logging
 * @returns Object with response and status code
 */
export function handleApiError(
  error: unknown,
  context?: string
): { response: SafeErrorResponse; status: number } {
  const code = categorizeError(error);
  const response = createSafeErrorResponse(error, code, context);
  const status = getErrorStatusCode(code);

  return { response, status };
}

/**
 * Create a validation error response
 *
 * Convenience function for validation errors where you want
 * to include a custom message.
 *
 * @param message - Custom validation error message
 * @returns Safe error response
 */
export function createValidationError(message: string): SafeErrorResponse {
  // Log the validation error
  console.warn('[Validation Error]:', message);

  return {
    error: message,
    code: 'VALIDATION_ERROR',
  };
}

/**
 * Create a specific error response for embedding generation failures
 *
 * This function examines the error and returns a user-friendly message
 * that helps users understand what went wrong and what to do next.
 *
 * @param error - The caught error from embedding generation
 * @returns Safe error response with actionable message
 */
export function createEmbeddingError(error: unknown): SafeErrorResponse {
  // Log the full error for debugging
  console.error('[Embedding Error]:', error);

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // API key configuration issues
    if (msg.includes('api key') || msg.includes('api_key') || msg.includes('invalid key')) {
      return {
        error: 'Document processing is temporarily unavailable. Please try again later or contact support.',
        code: 'SERVICE_UNAVAILABLE',
      };
    }

    // Rate limiting from Google API
    if (msg.includes('rate limit') || msg.includes('quota') || msg.includes('resource exhausted')) {
      return {
        error: 'The AI service is currently busy. Please wait a minute and try again.',
        code: 'RATE_LIMITED',
      };
    }

    // Timeout errors
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return {
        error: 'Document processing timed out. Please try again.',
        code: 'TIMEOUT',
      };
    }

    // Network errors
    if (msg.includes('network') || msg.includes('fetch failed') || msg.includes('econnrefused')) {
      return {
        error: 'Could not connect to the AI service. Please check your connection and try again.',
        code: 'SERVICE_UNAVAILABLE',
      };
    }
  }

  // Default embedding error
  return {
    error: 'Failed to analyze document content. Please try uploading the document again.',
    code: 'INTERNAL_ERROR',
  };
}
