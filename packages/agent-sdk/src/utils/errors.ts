/**
 * Custom Error Classes
 */

/**
 * Base error for all Oblivion SDK errors.
 */
export class OblivionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OblivionError';
    Object.setPrototypeOf(this, OblivionError.prototype);
  }
}

/**
 * Authentication/authorization error.
 */
export class AuthError extends OblivionError {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * API request error.
 */
export class ApiError extends OblivionError {
  public readonly statusCode: number;
  public readonly endpoint: string;

  constructor(message: string, statusCode: number, endpoint: string) {
    super(`${message} (${statusCode} ${endpoint})`);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.endpoint = endpoint;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * WebSocket connection error.
 */
export class ConnectionError extends OblivionError {
  public readonly reason?: string;

  constructor(message: string, reason?: string) {
    super(message);
    this.name = 'ConnectionError';
    this.reason = reason;
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

/**
 * Configuration error.
 */
export class ConfigError extends OblivionError {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ConfigError';
    this.field = field;
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

/**
 * Task operation error.
 */
export class TaskError extends OblivionError {
  public readonly taskId?: string;

  constructor(message: string, taskId?: string) {
    super(message);
    this.name = 'TaskError';
    this.taskId = taskId;
    Object.setPrototypeOf(this, TaskError.prototype);
  }
}

/**
 * Request timeout error.
 */
export class TimeoutError extends OblivionError {
  public readonly timeoutMs: number;
  public readonly endpoint?: string;

  constructor(message: string, timeoutMs: number, endpoint?: string) {
    super(message);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.endpoint = endpoint;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}
