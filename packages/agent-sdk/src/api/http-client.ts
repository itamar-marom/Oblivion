/**
 * HTTP Client
 *
 * Generic REST client with authentication header injection.
 * Supports automatic 401 retry with token refresh for idempotent operations.
 * Includes configurable request timeouts.
 */

import type { TokenManager } from '../auth/token-manager.js';
import { ApiError, AuthError, TimeoutError } from '../utils/errors.js';
import { httpLogger } from '../utils/logger.js';

/** Default request timeout in milliseconds (30 seconds) */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Options for HTTP requests.
 */
export interface RequestOptions {
  /**
   * Whether to retry on 401 after refreshing the token.
   * Set to false for non-idempotent operations like claimTask or postToSlack.
   * Default: true (safe for reads and idempotent writes)
   */
  retryOn401?: boolean;

  /**
   * Request timeout in milliseconds.
   * Default: 30000 (30 seconds)
   */
  timeout?: number;
}

export interface HttpClientConfig {
  /** Default timeout for all requests in milliseconds. Default: 30000 */
  defaultTimeout?: number;
}

export class HttpClient {
  private baseUrl: string;
  private tokenManager: TokenManager;
  private defaultTimeout: number;

  constructor(baseUrl: string, tokenManager: TokenManager, config?: HttpClientConfig) {
    this.baseUrl = baseUrl;
    this.tokenManager = tokenManager;
    this.defaultTimeout = config?.defaultTimeout ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Make an authenticated request to Nexus.
   * Supports automatic retry on 401 with token refresh (controlled by options.retryOn401).
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const retryOn401 = options?.retryOn401 ?? true;
    const timeout = options?.timeout ?? this.defaultTimeout;
    return this.doRequest<T>(method, path, body, retryOn401, timeout, false);
  }

  /**
   * Internal request implementation with retry logic and timeout.
   */
  private async doRequest<T>(
    method: string,
    path: string,
    body: unknown | undefined,
    retryOn401: boolean,
    timeout: number,
    isRetry: boolean
  ): Promise<T> {
    const token = await this.tokenManager.getToken();
    const url = `${this.baseUrl}${path}`;

    httpLogger.debug(`${method} ${path}${isRetry ? ' (retry)' : ''} [timeout: ${timeout}ms]`);

    // Set up timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        httpLogger.error(`${method} ${path} timed out after ${timeout}ms`);
        throw new TimeoutError(`Request timed out after ${timeout}ms`, timeout, path);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      httpLogger.error(`${method} ${path} failed:`, response.status, errorText);

      // Handle 401 with automatic retry (if enabled and not already a retry)
      if (response.status === 401 && retryOn401 && !isRetry) {
        httpLogger.info('Got 401, refreshing token and retrying...');
        await this.tokenManager.refresh();
        return this.doRequest<T>(method, path, body, retryOn401, timeout, true);
      }

      if (response.status === 401) {
        throw new AuthError('Unauthorized', 401);
      }

      throw new ApiError(errorText || 'Request failed', response.status, path);
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      httpLogger.warn('Failed to parse JSON response, returning raw text');
      return text as unknown as T;
    }
  }

  /**
   * GET request.
   */
  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  /**
   * POST request.
   */
  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  /**
   * PATCH request.
   */
  async patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  /**
   * PUT request.
   */
  async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  /**
   * DELETE request.
   */
  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }
}
