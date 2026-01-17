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
 * Retry configuration for transient errors.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts. Default: 3 */
  maxRetries: number;
  /** Base delay in milliseconds for exponential backoff. Default: 1000 */
  baseDelayMs: number;
  /** Maximum delay in milliseconds. Default: 10000 */
  maxDelayMs: number;
}

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
   * Whether to retry on transient errors (502/503/504/timeout).
   * Set to false for non-idempotent operations (POST by default).
   * Default: true for GET/PUT/PATCH/DELETE, false for POST
   */
  retryOnTransient?: boolean;

  /**
   * Request timeout in milliseconds.
   * Default: 30000 (30 seconds)
   */
  timeout?: number;
}

export interface HttpClientConfig {
  /** Default timeout for all requests in milliseconds. Default: 30000 */
  defaultTimeout?: number;
  /** Retry configuration for transient errors. */
  retryConfig?: RetryConfig;
}

export class HttpClient {
  private baseUrl: string;
  private tokenManager: TokenManager;
  private defaultTimeout: number;
  private retryConfig: RetryConfig;

  constructor(baseUrl: string, tokenManager: TokenManager, config?: HttpClientConfig) {
    this.baseUrl = baseUrl;
    this.tokenManager = tokenManager;
    this.defaultTimeout = config?.defaultTimeout ?? DEFAULT_TIMEOUT_MS;
    this.retryConfig = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      ...config?.retryConfig,
    };
  }

  /**
   * Sleep for specified milliseconds (for retry backoff).
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay with jitter.
   */
  private calculateBackoff(attempt: number): number {
    const exponentialDelay = this.retryConfig.baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // 0-1s random jitter
    return Math.min(exponentialDelay + jitter, this.retryConfig.maxDelayMs);
  }

  /**
   * Make an authenticated request to Nexus.
   * Supports automatic retry on 401 with token refresh and transient errors.
   */
  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const retryOn401 = options?.retryOn401 ?? true;
    const timeout = options?.timeout ?? this.defaultTimeout;

    // POST operations are non-idempotent by default (prevent duplicate claims/posts)
    // GET/PUT/PATCH/DELETE are idempotent and safe to retry
    const retryOnTransient = options?.retryOnTransient ?? (method !== 'POST');

    return this.doRequest<T>(method, path, body, {
      retryOn401,
      retryOnTransient,
      timeout,
    });
  }

  /**
   * Internal request implementation with retry logic and timeout.
   */
  private async doRequest<T>(
    method: string,
    path: string,
    body: unknown | undefined,
    opts: { retryOn401: boolean; retryOnTransient: boolean; timeout: number }
  ): Promise<T> {
    const maxRetries = opts.retryOnTransient ? this.retryConfig.maxRetries : 0;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const token = await this.tokenManager.getToken();
      const url = `${this.baseUrl}${path}`;

      httpLogger.debug(
        `${method} ${path} [attempt ${attempt + 1}/${maxRetries + 1}, timeout: ${opts.timeout}ms]`
      );

      // Set up timeout with AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

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

        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);

        // Handle timeout errors
        if (error instanceof Error && error.name === 'AbortError') {
          httpLogger.error(`${method} ${path} timed out after ${opts.timeout}ms`);
          lastError = new TimeoutError(`Request timed out after ${opts.timeout}ms`, opts.timeout, path);

          // Retry on timeout if enabled and attempts remain
          if (opts.retryOnTransient && attempt < maxRetries) {
            const delay = this.calculateBackoff(attempt);
            httpLogger.info(`Retrying after timeout in ${delay}ms...`);
            await this.sleep(delay);
            continue;
          }

          throw lastError;
        }

        // Other fetch errors (network failures)
        lastError = error as Error;
        if (opts.retryOnTransient && attempt < maxRetries) {
          const delay = this.calculateBackoff(attempt);
          httpLogger.info(`Network error, retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }

        throw error;
      }

      if (!response.ok) {
        const errorText = await response.text();
        httpLogger.error(`${method} ${path} failed:`, response.status, errorText);

        // Handle 401 with token refresh (separate from transient retry logic)
        if (response.status === 401 && opts.retryOn401 && attempt === 0) {
          httpLogger.info('Got 401, refreshing token and retrying...');
          await this.tokenManager.refresh();
          // Retry immediately (not counted against maxRetries)
          const token = await this.tokenManager.getToken();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

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
            clearTimeout(timeoutId);

            if (response.ok) {
              return this.parseResponse<T>(response);
            }

            // 401 after refresh = auth failure
            if (response.status === 401) {
              throw new AuthError('Unauthorized after token refresh', 401);
            }
          } catch (error) {
            clearTimeout(timeoutId);
            throw error;
          }
        }

        // Retry on server errors (502/503/504)
        if ([502, 503, 504].includes(response.status) && opts.retryOnTransient && attempt < maxRetries) {
          const delay = this.calculateBackoff(attempt);
          httpLogger.info(`Got ${response.status}, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
          await this.sleep(delay);
          continue;
        }

        if (response.status === 401) {
          throw new AuthError('Unauthorized', 401);
        }

        throw new ApiError(errorText || 'Request failed', response.status, path);
      }

      // Success - parse and return
      return this.parseResponse<T>(response);
    }

    // Should never reach here, but for type safety
    throw lastError || new ApiError('Max retries exceeded', 0, path);
  }

  /**
   * Parse response body.
   */
  private async parseResponse<T>(response: Response): Promise<T> {
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
