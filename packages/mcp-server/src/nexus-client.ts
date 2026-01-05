/**
 * Nexus API Client
 *
 * HTTP client for communicating with the Nexus backend.
 * Handles JWT authentication with automatic token refresh.
 */

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

export class NexusClient {
  private config: NexusConfig;
  private token: AuthToken | null = null;

  constructor(config: NexusConfig) {
    this.config = config;
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
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Authentication failed: ${response.status} ${error}`);
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
   * Get a valid token, refreshing if needed
   */
  private async getToken(): Promise<string> {
    if (!this.token || Date.now() >= this.token.expiresAt) {
      this.token = await this.authenticate();
    }
    return this.token.accessToken;
  }

  /**
   * Make an authenticated request to Nexus
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const token = await this.getToken();

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Nexus API error: ${response.status} ${error}`);
    }

    return response.json() as Promise<T>;
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
}

/**
 * Create a NexusClient from environment variables
 */
export function createNexusClientFromEnv(): NexusClient {
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
