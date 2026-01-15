/**
 * Nexus API Client
 *
 * HTTP client for communicating with the Nexus backend.
 * Handles JWT authentication with automatic token refresh.
 */

import {
  NexusError,
  ErrorCode,
  httpStatusToErrorCode,
  isRetryableErrorCode,
  createErrorFromException,
} from './errors.js';

// Re-export error types for consumers
export { NexusError, ErrorCode } from './errors.js';

export interface NexusConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

export interface AuthToken {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: number;
}

export interface Task {
  id: string;
  clickupTaskId: string;
  title: string;
  description?: string;
  status: 'TODO' | 'CLAIMED' | 'IN_PROGRESS' | 'BLOCKED_ON_HUMAN' | 'DONE';
  priority: number;
  projectId: string;
  project?: {
    id: string;
    name: string;
    slug: string;
    oblivionTag?: string;
    slackChannelId?: string;
    slackChannelName?: string;
    group?: {
      id: string;
      name: string;
      slug: string;
    };
  };
  claimedByAgentId?: string;
  claimedByAgent?: {
    id: string;
    name: string;
  };
  claimedAt?: string;
  slackChannelId?: string;
  slackThreadTs?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableTask {
  taskId: string;
  clickupTaskId: string;
  title: string;
  priority: number;
  projectId: string;
  projectName: string;
  groupId: string;
  groupName: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  clientId: string;
  email?: string;
  avatarUrl?: string;
  slackUserId?: string;
  capabilities: string[];
  isActive: boolean;
  lastSeenAt?: string;
  createdAt: string;
  isConnected: boolean;
  connectionStatus: 'idle' | 'working' | 'connected' | 'error' | 'offline';
  connectedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  oblivionTag?: string;
  slackChannelId?: string;
  slackChannelName?: string;
  isActive: boolean;
  groupId: string;
  group?: {
    id: string;
    name: string;
    slug: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  connectedAgents: number;
  totalAgents: number;
  activeTasks: number;
  pendingTasks: number;
  totalGroups: number;
  totalProjects: number;
}

export interface ClaimTaskResult {
  taskId: string;
  success: boolean;
  claimedAt?: string;
  error?: string;
}

export interface UpdateStatusResult {
  id: string;
  status: string;
  updatedAt: string;
}

export interface SlackThreadReplyResult {
  ok: boolean;
  channelId?: string;
  messageTs?: string;
  error?: string;
}

export interface SlackThreadMessage {
  ts: string;
  threadTs?: string;
  user: string;
  username?: string;
  botId?: string;
  text: string;
  type: string;
  createdAt: string;
}

export interface SlackThreadResult {
  ok: boolean;
  taskId: string;
  clickupTaskId: string;
  title?: string;
  channelId: string;
  threadTs: string;
  messages: SlackThreadMessage[];
  hasMore: boolean;
  nextCursor?: string;
  claimedBy?: string;
  projectName: string;
  groupName: string;
  error?: string;
}

// =========================================================================
// Registration Types
// =========================================================================

export interface RegisterAgentRequest {
  registrationToken: string;
  name: string;
  clientId: string;
  clientSecret: string;
  description?: string;
  email?: string;
  capabilities?: string[];
}

export interface RegisterAgentResult {
  id: string;
  clientId: string;
  name: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  pendingGroup?: {
    id: string;
    name: string;
  };
  message: string;
}

export interface RegistrationStatusResult {
  id: string;
  clientId: string;
  name: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  pendingGroup?: {
    id: string;
    name: string;
  };
  rejectionReason?: string;
}

// =========================================================================
// Retry Configuration
// =========================================================================

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Sleep with exponential backoff and jitter
 */
function sleepWithBackoff(attempt: number, config: RetryConfig): Promise<void> {
  const delay = Math.min(
    config.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
    config.maxDelayMs
  );
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown, config: RetryConfig): boolean {
  if (error instanceof Error) {
    // Network errors are retryable
    if (error.name === 'AbortError' || error.message.includes('fetch failed')) {
      return true;
    }
    // Check for HTTP status codes
    const statusMatch = error.message.match(/(\d{3})/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      return config.retryableStatuses.includes(status);
    }
  }
  return false;
}

export interface NexusClientOptions {
  retryConfig?: Partial<RetryConfig>;
  timeoutMs?: number;
  keepAlive?: boolean; // Enable HTTP keep-alive for connection reuse (default: true)
}

export class NexusClient {
  private config: NexusConfig;
  private token: AuthToken | null = null;
  private refreshPromise: Promise<AuthToken> | null = null; // Prevents concurrent auth requests
  private retryConfig: RetryConfig;
  private timeoutMs: number;
  private keepAlive: boolean;

  constructor(config: NexusConfig, options?: NexusClientOptions) {
    this.config = config;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options?.retryConfig };
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.keepAlive = options?.keepAlive ?? true; // Enable keep-alive by default
  }

  /**
   * Authenticate with Nexus and get JWT token
   */
  private async authenticate(): Promise<AuthToken> {
    const response = await fetch(`${this.config.baseUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
      keepalive: this.keepAlive,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const code = response.status === 401
        ? ErrorCode.AUTH_INVALID_CREDENTIALS
        : httpStatusToErrorCode(response.status);

      throw new NexusError({
        code,
        message: `Authentication failed: ${errorText || response.statusText}`,
        httpStatus: response.status,
        retryable: isRetryableErrorCode(code),
        context: { clientId: this.config.clientId },
      });
    }

    const data = await response.json() as {
      access_token: string;
      token_type: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      expiresAt: Date.now() + (data.expires_in * 1000) - 60000, // Refresh 1 min early
    };
  }

  /**
   * Get a valid token, refreshing if needed.
   * Uses refreshPromise pattern to prevent concurrent auth requests (race condition fix).
   */
  private async getToken(): Promise<string> {
    // If token is still valid, return it immediately
    if (this.token && Date.now() < this.token.expiresAt) {
      return this.token.accessToken;
    }

    // If another call is already refreshing, wait for it
    if (this.refreshPromise) {
      const token = await this.refreshPromise;
      return token.accessToken;
    }

    // Start the refresh and store the promise
    this.refreshPromise = this.authenticate();

    try {
      this.token = await this.refreshPromise;
      return this.token.accessToken;
    } finally {
      // Clear the promise so future calls can refresh again
      this.refreshPromise = null;
    }
  }

  /**
   * Make an authenticated request to Nexus with retry logic
   *
   * @param method - HTTP method
   * @param path - API path
   * @param body - Request body (optional)
   * @param options - Request options
   * @param options.isIdempotent - Whether the operation is safe to retry (default: true for GET/PUT/PATCH/DELETE, false for POST)
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { isIdempotent?: boolean }
  ): Promise<T> {
    // POST requests are non-idempotent by default (could cause duplicates)
    // GET, PUT, PATCH, DELETE are idempotent by default
    const isIdempotent = options?.isIdempotent ?? (method !== 'POST');
    const maxRetries = isIdempotent ? this.retryConfig.maxRetries : 0;

    let lastError: NexusError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const token = await this.getToken();

        const response = await fetch(`${this.config.baseUrl}${path}`, {
          method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(this.timeoutMs),
          keepalive: this.keepAlive,
        });

        if (!response.ok) {
          const errorText = await response.text();
          const code = httpStatusToErrorCode(response.status);
          const err = new NexusError({
            code,
            message: errorText || response.statusText || `HTTP ${response.status}`,
            httpStatus: response.status,
            retryable: isRetryableErrorCode(code),
            context: { method, path },
          });

          // Check if we should retry (respects idempotency setting)
          if (attempt < maxRetries &&
              this.retryConfig.retryableStatuses.includes(response.status)) {
            lastError = err;
            await sleepWithBackoff(attempt, this.retryConfig);
            continue;
          }

          throw err;
        }

        return response.json() as Promise<T>;
      } catch (error) {
        // Convert to NexusError if not already
        lastError = createErrorFromException(error, ErrorCode.UNKNOWN, { method, path });

        // Check if we should retry (respects idempotency setting)
        if (attempt < maxRetries && lastError.retryable) {
          await sleepWithBackoff(attempt, this.retryConfig);
          continue;
        }

        throw lastError;
      }
    }

    throw lastError ?? new NexusError({
      code: ErrorCode.UNKNOWN,
      message: 'Request failed after retries',
      retryable: false,
      context: { method, path },
    });
  }

  // =========================================================================
  // Task APIs
  // =========================================================================

  /**
   * Get available (unclaimed) tasks
   */
  async getAvailableTasks(): Promise<AvailableTask[]> {
    return this.request<AvailableTask[]>('GET', '/tasks/available');
  }

  /**
   * Get tasks claimed by the current agent
   */
  async getClaimedTasks(): Promise<Task[]> {
    return this.request<Task[]>('GET', '/tasks/claimed');
  }

  /**
   * Get a specific task by ClickUp ID
   */
  async getTask(clickupTaskId: string): Promise<Task> {
    return this.request<Task>('GET', `/tasks/${clickupTaskId}`);
  }

  /**
   * Get a specific task by internal ID
   */
  async getTaskById(taskId: string): Promise<Task> {
    return this.request<Task>('GET', `/tasks/by-id/${taskId}`);
  }

  /**
   * Claim a task
   */
  async claimTask(taskId: string): Promise<ClaimTaskResult> {
    return this.request<ClaimTaskResult>('POST', `/tasks/${taskId}/claim`);
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    taskId: string,
    status: 'IN_PROGRESS' | 'BLOCKED_ON_HUMAN' | 'DONE'
  ): Promise<UpdateStatusResult> {
    return this.request<UpdateStatusResult>('PATCH', `/tasks/${taskId}/status`, { status });
  }

  /**
   * Create a new task
   */
  async createTask(
    projectId: string,
    title: string,
    priority?: number
  ): Promise<Task> {
    return this.request<Task>('POST', '/observer/tasks', {
      projectId,
      title,
      priority,
    });
  }

  // =========================================================================
  // Observer APIs
  // =========================================================================

  /**
   * Get dashboard statistics
   */
  async getStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('GET', '/observer/stats');
  }

  /**
   * Get all agents with connection status
   */
  async getAgents(): Promise<Agent[]> {
    return this.request<Agent[]>('GET', '/observer/agents');
  }

  /**
   * Get all tasks grouped by status
   */
  async getAllTasks(): Promise<{
    todo: Task[];
    claimed: Task[];
    inProgress: Task[];
    done: Task[];
  }> {
    return this.request('GET', '/observer/tasks');
  }

  // =========================================================================
  // Project APIs
  // =========================================================================

  /**
   * Get all projects
   */
  async getProjects(groupId?: string): Promise<Project[]> {
    const query = groupId ? `?groupId=${groupId}` : '';
    return this.request<Project[]>('GET', `/projects${query}`);
  }

  /**
   * Get a specific project
   */
  async getProject(projectId: string): Promise<Project> {
    return this.request<Project>('GET', `/projects/${projectId}`);
  }

  // =========================================================================
  // Slack APIs
  // =========================================================================

  /**
   * Post a message to a task's Slack thread
   */
  async postToSlackThread(
    taskId: string,
    message: string,
    broadcast?: boolean
  ): Promise<SlackThreadReplyResult> {
    return this.request<SlackThreadReplyResult>('POST', `/tasks/${taskId}/slack-reply`, {
      message,
      broadcast,
    });
  }

  /**
   * Get Slack thread messages for a task
   */
  async getTaskSlackThread(
    taskId: string,
    limit?: number,
    cursor?: string
  ): Promise<SlackThreadResult> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (cursor) params.append('cursor', cursor);

    const query = params.toString() ? `?${params.toString()}` : '';

    return this.request<SlackThreadResult>('GET', `/tasks/${taskId}/slack-thread${query}`);
  }

  // =========================================================================
  // Registration APIs (unauthenticated)
  // =========================================================================

  /**
   * Register a new agent using a registration token.
   * This endpoint does NOT require authentication - the token serves as authorization.
   */
  async registerAgent(data: RegisterAgentRequest): Promise<RegisterAgentResult> {
    const response = await fetch(`${this.config.baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(this.timeoutMs),
      keepalive: this.keepAlive,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` })) as { message?: string };
      throw new Error(error.message || `Registration failed: ${response.status}`);
    }

    return response.json() as Promise<RegisterAgentResult>;
  }

  /**
   * Check registration/authentication status by attempting to authenticate.
   * Returns the status or error message.
   */
  async checkAuthStatus(clientId: string, clientSecret: string): Promise<RegistrationStatusResult> {
    const response = await fetch(`${this.config.baseUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
      keepalive: this.keepAlive,
    });

    if (response.ok) {
      // Successfully authenticated - agent is approved
      return {
        id: '',
        clientId,
        name: '',
        approvalStatus: 'APPROVED',
      };
    }

    const error = await response.json().catch(() => ({ message: 'Unknown error' })) as { message?: string };
    const message = error.message || '';

    // Parse the error message to determine status
    if (message.includes('pending')) {
      return {
        id: '',
        clientId,
        name: '',
        approvalStatus: 'PENDING',
      };
    } else if (message.includes('rejected')) {
      return {
        id: '',
        clientId,
        name: '',
        approvalStatus: 'REJECTED',
        rejectionReason: message,
      };
    }

    throw new Error(message || 'Authentication check failed');
  }
}

/**
 * Create a NexusClient from environment variables and/or saved credentials
 * Priority: env vars > saved credentials file
 *
 * Note: Import getEffectiveCredentials in the calling code to avoid circular deps
 */
export function createNexusClientFromEnv(): NexusClient {
  // These will be checked by server.ts which imports credentials-manager
  const baseUrl = process.env.NEXUS_URL;
  const clientId = process.env.NEXUS_CLIENT_ID;
  const clientSecret = process.env.NEXUS_CLIENT_SECRET;

  if (!baseUrl) {
    throw new Error('NEXUS_URL environment variable is required');
  }
  if (!clientId) {
    throw new Error('NEXUS_CLIENT_ID environment variable is required');
  }
  if (!clientSecret) {
    throw new Error('NEXUS_CLIENT_SECRET environment variable is required');
  }

  return new NexusClient({
    baseUrl,
    clientId,
    clientSecret,
  });
}

/**
 * Check if we're in bootstrap mode (only NEXUS_URL set, no credentials)
 *
 * Note: Only checks env vars. Calling code should check saved credentials too.
 */
export function isBootstrapMode(): boolean {
  const baseUrl = process.env.NEXUS_URL;
  const clientId = process.env.NEXUS_CLIENT_ID;
  const clientSecret = process.env.NEXUS_CLIENT_SECRET;

  return !!baseUrl && (!clientId || !clientSecret);
}

/**
 * Create a NexusClient for bootstrap mode (registration only)
 * Only requires NEXUS_URL - credentials are not needed for registration
 */
export function createBootstrapClient(): NexusClient {
  const baseUrl = process.env.NEXUS_URL;

  if (!baseUrl) {
    throw new Error('NEXUS_URL environment variable is required');
  }

  // Create client with placeholder credentials - they won't be used for registration
  return new NexusClient({
    baseUrl,
    clientId: 'bootstrap',
    clientSecret: 'bootstrap',
  });
}
