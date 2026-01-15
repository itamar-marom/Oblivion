/**
 * Structured Error Codes for MCP Server
 *
 * Provides machine-readable error codes for better debugging and retry logic.
 * Each error code has a unique identifier that can be used for:
 * - Programmatic error handling
 * - Logging and monitoring
 * - User-friendly error messages
 */

export enum ErrorCode {
  // Authentication errors (1xxx)
  AUTH_FAILED = 'AUTH_FAILED',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_PENDING_APPROVAL = 'AUTH_PENDING_APPROVAL',
  AUTH_REJECTED = 'AUTH_REJECTED',

  // Network errors (2xxx)
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION_FAILED = 'NETWORK_CONNECTION_FAILED',
  NETWORK_DNS_FAILED = 'NETWORK_DNS_FAILED',

  // API errors (3xxx)
  API_ERROR = 'API_ERROR',
  API_NOT_FOUND = 'API_NOT_FOUND',
  API_CONFLICT = 'API_CONFLICT',
  API_RATE_LIMITED = 'API_RATE_LIMITED',
  API_SERVER_ERROR = 'API_SERVER_ERROR',
  API_SERVICE_UNAVAILABLE = 'API_SERVICE_UNAVAILABLE',

  // Task errors (4xxx)
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_ALREADY_CLAIMED = 'TASK_ALREADY_CLAIMED',
  TASK_NOT_AUTHORIZED = 'TASK_NOT_AUTHORIZED',

  // Profile lock errors (5xxx)
  LOCK_ACQUISITION_FAILED = 'LOCK_ACQUISITION_FAILED',
  LOCK_TIMEOUT = 'LOCK_TIMEOUT',
  LOCK_FILE_CORRUPTED = 'LOCK_FILE_CORRUPTED',
  NO_PROFILES_AVAILABLE = 'NO_PROFILES_AVAILABLE',

  // Configuration errors (6xxx)
  CONFIG_MISSING_URL = 'CONFIG_MISSING_URL',
  CONFIG_MISSING_CREDENTIALS = 'CONFIG_MISSING_CREDENTIALS',
  CONFIG_INVALID = 'CONFIG_INVALID',

  // Unknown errors
  UNKNOWN = 'UNKNOWN',
}

export interface NexusErrorDetails {
  code: ErrorCode;
  message: string;
  httpStatus?: number;
  retryable: boolean;
  context?: Record<string, unknown>;
}

/**
 * Custom error class with structured error information
 */
export class NexusError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus?: number;
  public readonly retryable: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(details: NexusErrorDetails) {
    super(details.message);
    this.name = 'NexusError';
    this.code = details.code;
    this.httpStatus = details.httpStatus;
    this.retryable = details.retryable;
    this.context = details.context;

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NexusError);
    }
  }

  /**
   * Create a JSON-serializable representation
   */
  toJSON(): NexusErrorDetails & { name: string; stack?: string } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      retryable: this.retryable,
      context: this.context,
      stack: this.stack,
    };
  }

  /**
   * Format for display
   */
  toString(): string {
    const status = this.httpStatus ? ` (HTTP ${this.httpStatus})` : '';
    return `[${this.code}]${status}: ${this.message}`;
  }
}

/**
 * Parse HTTP status code to error code
 */
export function httpStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 401:
      return ErrorCode.AUTH_INVALID_CREDENTIALS;
    case 403:
      return ErrorCode.TASK_NOT_AUTHORIZED;
    case 404:
      return ErrorCode.API_NOT_FOUND;
    case 408:
      return ErrorCode.NETWORK_TIMEOUT;
    case 409:
      return ErrorCode.API_CONFLICT;
    case 429:
      return ErrorCode.API_RATE_LIMITED;
    case 500:
      return ErrorCode.API_SERVER_ERROR;
    case 502:
    case 503:
    case 504:
      return ErrorCode.API_SERVICE_UNAVAILABLE;
    default:
      return status >= 500 ? ErrorCode.API_SERVER_ERROR : ErrorCode.API_ERROR;
  }
}

/**
 * Check if an error code is retryable
 */
export function isRetryableErrorCode(code: ErrorCode): boolean {
  const retryableCodes: ErrorCode[] = [
    ErrorCode.NETWORK_TIMEOUT,
    ErrorCode.NETWORK_CONNECTION_FAILED,
    ErrorCode.API_RATE_LIMITED,
    ErrorCode.API_SERVER_ERROR,
    ErrorCode.API_SERVICE_UNAVAILABLE,
    ErrorCode.LOCK_TIMEOUT,
  ];
  return retryableCodes.includes(code);
}

/**
 * Create a NexusError from a fetch response
 */
export async function createErrorFromResponse(
  response: Response,
  context?: Record<string, unknown>
): Promise<NexusError> {
  const code = httpStatusToErrorCode(response.status);
  let message: string;

  try {
    const body = await response.text();
    message = body || response.statusText || `HTTP ${response.status}`;
  } catch {
    message = response.statusText || `HTTP ${response.status}`;
  }

  return new NexusError({
    code,
    message,
    httpStatus: response.status,
    retryable: isRetryableErrorCode(code),
    context,
  });
}

/**
 * Create a NexusError from a caught exception
 */
export function createErrorFromException(
  error: unknown,
  defaultCode: ErrorCode = ErrorCode.UNKNOWN,
  context?: Record<string, unknown>
): NexusError {
  if (error instanceof NexusError) {
    return error;
  }

  if (error instanceof Error) {
    // Check for specific error types
    let code = defaultCode;
    let retryable = false;

    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      code = ErrorCode.NETWORK_TIMEOUT;
      retryable = true;
    } else if (
      error.message.includes('fetch failed') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND')
    ) {
      code = ErrorCode.NETWORK_CONNECTION_FAILED;
      retryable = true;
    }

    return new NexusError({
      code,
      message: error.message,
      retryable,
      context,
    });
  }

  return new NexusError({
    code: defaultCode,
    message: String(error),
    retryable: false,
    context,
  });
}
