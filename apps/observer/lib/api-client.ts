/**
 * API Client for Nexus
 *
 * Handles HTTP requests with JWT authentication.
 * Tokens are stored in localStorage and auto-refreshed on expiry.
 */

const NEXUS_URL = process.env.NEXT_PUBLIC_NEXUS_URL || "http://localhost:3000";

// Token storage keys
const TOKEN_KEY = "nexus_token";
const TOKEN_EXPIRY_KEY = "nexus_token_expiry";

/**
 * Auth response from POST /auth/token
 */
export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * API error response
 */
export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

/**
 * Store JWT token in localStorage
 */
export function setToken(token: string, expiresIn: number): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(TOKEN_KEY, token);
  const expiry = Date.now() + expiresIn * 1000;
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString());
}

/**
 * Get stored JWT token
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Check if token is expired or about to expire (within 60 seconds)
 */
export function isTokenExpired(): boolean {
  if (typeof window === "undefined") return true;

  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiry) return true;

  // Consider expired if within 60 seconds of expiry
  return Date.now() > parseInt(expiry) - 60000;
}

/**
 * Clear stored token
 */
export function clearToken(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

/**
 * Authenticate with Nexus using client credentials
 */
export async function authenticate(
  clientId: string,
  clientSecret: string
): Promise<AuthResponse> {
  const response = await fetch(`${NEXUS_URL}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Authentication failed");
  }

  const data: AuthResponse = await response.json();
  setToken(data.access_token, data.expires_in);
  return data;
}

/**
 * Make an authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  if (!token) {
    throw new Error("Not authenticated");
  }

  if (isTokenExpired()) {
    throw new Error("Token expired");
  }

  const response = await fetch(`${NEXUS_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: `HTTP ${response.status}`,
    }));
    throw new Error(error.message || `Request failed: ${response.status}`);
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// =============================================================================
// OBSERVER ENDPOINTS
// =============================================================================

/**
 * Dashboard statistics
 */
export interface ObserverStats {
  connectedAgents: number;
  totalAgents: number;
  activeTasks: number;
  pendingTasks: number;
  totalGroups: number;
  totalProjects: number;
  pendingApprovals: number;
}

/**
 * Agent with connection status
 */
export interface ObserverAgent {
  id: string;
  name: string;
  description: string | null;
  clientId: string;
  email?: string | null;
  avatarUrl?: string | null;
  slackUserId?: string | null;
  capabilities: string[];
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  isConnected: boolean;
  connectionStatus: "connected" | "idle" | "working" | "error" | "offline";
  connectedAt?: string;
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
}

/**
 * Pending agent awaiting approval
 */
export interface PendingAgent {
  id: string;
  name: string;
  clientId: string;
  description: string | null;
  email: string | null;
  capabilities: string[];
  approvalStatus: "PENDING";
  pendingGroup: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
}

/**
 * Registration token for agent self-registration
 */
export interface RegistrationToken {
  id: string;
  token: string;
  name: string | null;
  groupId: string;
  groupName: string;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  };
}

/**
 * DTO for creating a registration token
 */
export interface CreateRegistrationTokenDto {
  groupId: string;
  name?: string;
  expiresInHours?: number;
  maxUses?: number;
}

/**
 * DTO for rejecting an agent
 */
export interface RejectAgentDto {
  reason?: string;
}

/**
 * DTO for creating an agent
 */
export interface CreateAgentDto {
  name: string;
  clientId: string;
  clientSecret: string;
  description?: string;
  capabilities?: string[];
}

/**
 * DTO for updating an agent
 */
export interface UpdateAgentDto {
  name?: string;
  description?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  slackUserId?: string | null;
  capabilities?: string[];
}

/**
 * Activity event
 */
export interface ObserverActivityEvent {
  id: string;
  type: "task_created" | "task_claimed" | "agent_connected" | "agent_disconnected" | "status_change";
  timestamp: string;
  agentId?: string;
  agentName?: string;
  taskId?: string;
  taskTitle?: string | null;
  projectName?: string;
  details?: string;
}

/**
 * Task queue grouped by status
 */
export interface TaskQueue {
  todo: TaskQueueItem[];
  claimed: TaskQueueItem[];
  inProgress: TaskQueueItem[];
  done: TaskQueueItem[];
}

export interface TaskQueueItem {
  id: string;
  projectId: string;
  clickupTaskId: string;
  title: string | null;
  status: string;
  priority: number;
  claimedByAgentId: string | null;
  claimedAt: string | null;
  createdAt: string;
  project: {
    id: string;
    name: string;
    group: {
      id: string;
      name: string;
    };
  };
  claimedByAgent?: {
    id: string;
    name: string;
  };
}

export const observerApi = {
  /**
   * Get dashboard statistics
   */
  getStats: () => apiRequest<ObserverStats>("/observer/stats"),

  /**
   * Get all agents with connection status
   */
  getAgents: () => apiRequest<ObserverAgent[]>("/observer/agents"),

  /**
   * Get a single agent by ID
   */
  getAgent: (id: string) => apiRequest<ObserverAgent>(`/observer/agents/${id}`),

  /**
   * Create a new agent
   */
  createAgent: (dto: CreateAgentDto) =>
    apiRequest<ObserverAgent>("/observer/agents", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  /**
   * Update an agent's profile
   */
  updateAgent: (id: string, dto: UpdateAgentDto) =>
    apiRequest<ObserverAgent>(`/observer/agents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    }),

  /**
   * Get recent activity events
   */
  getActivity: (limit = 50) =>
    apiRequest<ObserverActivityEvent[]>(`/observer/activity?limit=${limit}`),

  /**
   * Get task queue grouped by status
   */
  getTaskQueue: () => apiRequest<TaskQueue>("/observer/tasks"),

  // =========================================================================
  // AGENT APPROVAL WORKFLOW
  // =========================================================================

  /**
   * Get pending agents awaiting approval
   */
  getPendingAgents: () => apiRequest<PendingAgent[]>("/observer/agents/pending"),

  /**
   * Get count of pending agents (for badge)
   */
  getPendingCount: () => apiRequest<{ count: number }>("/observer/agents/pending/count"),

  /**
   * Approve a pending agent
   */
  approveAgent: (id: string) =>
    apiRequest<ObserverAgent>(`/observer/agents/${id}/approve`, {
      method: "POST",
    }),

  /**
   * Reject a pending agent
   */
  rejectAgent: (id: string, dto: RejectAgentDto) =>
    apiRequest<ObserverAgent>(`/observer/agents/${id}/reject`, {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  // =========================================================================
  // REGISTRATION TOKENS
  // =========================================================================

  /**
   * Create a registration token
   */
  createRegistrationToken: (dto: CreateRegistrationTokenDto) =>
    apiRequest<RegistrationToken>("/observer/registration-tokens", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  /**
   * List registration tokens
   */
  listRegistrationTokens: (groupId?: string) =>
    apiRequest<RegistrationToken[]>(
      `/observer/registration-tokens${groupId ? `?groupId=${groupId}` : ""}`
    ),

  /**
   * Revoke a registration token
   */
  revokeRegistrationToken: (id: string) =>
    apiRequest<{ success: boolean }>(`/observer/registration-tokens/${id}`, {
      method: "DELETE",
    }),
};

// =============================================================================
// GROUPS ENDPOINTS
// =============================================================================

export interface Group {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  slackChannelId: string | null;
  slackChannelName: string | null;
  isActive: boolean;
  memberCount: number;
  projectCount: number;
  createdAt: string;
  updatedAt?: string;
  members?: GroupMember[];
  projects?: GroupProject[];
}

export interface GroupMember {
  id: string;
  role: string;
  joinedAt: string;
  agent: {
    id: string;
    name: string;
    description?: string | null;
    avatarUrl?: string | null;
    isActive: boolean;
    lastSeenAt?: string | null;
    capabilities?: string[];
  };
}

export interface GroupProject {
  id: string;
  name: string;
  slug: string;
  oblivionTag: string | null;
  slackChannelName: string | null;
  isActive: boolean;
}

export interface CreateGroupDto {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateGroupDto {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface AddMemberDto {
  agentId: string;
  role?: "lead" | "member";
}

export const groupsApi = {
  /**
   * List all groups
   */
  list: (includeInactive = false) =>
    apiRequest<Group[]>(`/groups${includeInactive ? "?includeInactive=true" : ""}`),

  /**
   * Get a single group with full details
   */
  get: (id: string) => apiRequest<Group>(`/groups/${id}`),

  /**
   * Create a new group
   */
  create: (dto: CreateGroupDto) =>
    apiRequest<Group>("/groups", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  /**
   * Update a group
   */
  update: (id: string, dto: UpdateGroupDto) =>
    apiRequest<Group>(`/groups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    }),

  /**
   * Archive a group
   */
  archive: (id: string) =>
    apiRequest<{ success: boolean; message: string }>(`/groups/${id}`, {
      method: "DELETE",
    }),

  /**
   * Get group members
   */
  getMembers: (groupId: string) =>
    apiRequest<GroupMember[]>(`/groups/${groupId}/members`),

  /**
   * Add a member to a group
   */
  addMember: (groupId: string, dto: AddMemberDto) =>
    apiRequest<GroupMember>(`/groups/${groupId}/members`, {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  /**
   * Remove a member from a group
   */
  removeMember: (groupId: string, agentId: string) =>
    apiRequest<{ success: boolean; message: string }>(
      `/groups/${groupId}/members/${agentId}`,
      { method: "DELETE" }
    ),
};

// =============================================================================
// PROJECTS ENDPOINTS
// =============================================================================

export interface Project {
  id: string;
  groupId: string;
  name: string;
  slug: string;
  description: string | null;
  oblivionTag: string | null;
  slackChannelId: string | null;
  slackChannelName: string | null;
  isActive: boolean;
  taskCount: number;
  createdAt: string;
  updatedAt?: string;
  group?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface CreateProjectDto {
  groupId: string;
  name: string;
  slug: string;
  description?: string;
  oblivionTag: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string | null;
  oblivionTag?: string;
  isActive?: boolean;
}

export const projectsApi = {
  /**
   * List all projects
   */
  list: (includeInactive = false) =>
    apiRequest<Project[]>(
      `/projects${includeInactive ? "?includeInactive=true" : ""}`
    ),

  /**
   * Get a single project with full details
   */
  get: (id: string) => apiRequest<Project>(`/projects/${id}`),

  /**
   * Create a new project
   */
  create: (dto: CreateProjectDto) =>
    apiRequest<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(dto),
    }),

  /**
   * Update a project
   */
  update: (id: string, dto: UpdateProjectDto) =>
    apiRequest<Project>(`/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(dto),
    }),

  /**
   * Archive a project
   */
  archive: (id: string) =>
    apiRequest<{ success: boolean; message: string }>(`/projects/${id}`, {
      method: "DELETE",
    }),
};

// =============================================================================
// TASKS ENDPOINTS
// =============================================================================

export interface Task {
  id: string;
  projectId: string;
  clickupTaskId: string;
  title: string | null;
  description: string | null;
  status: "TODO" | "CLAIMED" | "IN_PROGRESS" | "BLOCKED_ON_HUMAN" | "DONE";
  priority: number;
  claimedByAgentId: string | null;
  claimedAt: string | null;
  slackChannelId: string | null;
  slackThreadTs: string | null;
  createdAt: string;
  updatedAt?: string;
  project?: {
    id: string;
    name: string;
    group: {
      id: string;
      name: string;
    };
  };
  claimedByAgent?: {
    id: string;
    name: string;
  };
}

export const tasksApi = {
  /**
   * List all tasks
   */
  list: (params?: { projectId?: string; status?: string }) =>
    apiRequest<Task[]>(
      `/tasks${params ? `?${new URLSearchParams(params as Record<string, string>)}` : ""}`
    ),

  /**
   * Get a single task
   */
  get: (id: string) => apiRequest<Task>(`/tasks/${id}`),
};
