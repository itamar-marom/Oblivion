/**
 * Core Types
 */

/**
 * Configuration for OblivionAgent.
 */
export interface AgentConfig {
  /** Nexus server URL (e.g., "http://localhost:3000") */
  nexusUrl: string;
  /** OAuth2 client ID */
  clientId: string;
  /** OAuth2 client secret */
  clientSecret: string;
  /** Agent capabilities (e.g., ["code", "review", "test"]) */
  capabilities?: string[];
  /** SDK version to report */
  version?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Max reconnect attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Reconnect delay in ms (default: 1000, max: 30000 with exponential backoff) */
  reconnectDelay?: number;
}

/**
 * Task status enum.
 */
export type TaskStatus = 'TODO' | 'CLAIMED' | 'IN_PROGRESS' | 'BLOCKED_ON_HUMAN' | 'DONE';

/**
 * Task update status (subset allowed for updates).
 */
export type TaskUpdateStatus = 'IN_PROGRESS' | 'BLOCKED_ON_HUMAN' | 'DONE';

/**
 * Task entity from Nexus.
 */
export interface Task {
  id: string;
  clickupTaskId: string;
  title: string;
  description?: string;
  status: TaskStatus;
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

/**
 * Available task (unclaimed) summary.
 */
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

/**
 * Agent entity.
 */
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

/**
 * Project entity.
 */
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

/**
 * Claim task result.
 */
export interface ClaimTaskResult {
  taskId: string;
  success: boolean;
  claimedAt?: string;
  error?: string;
}

/**
 * Update status result.
 */
export interface UpdateStatusResult {
  id: string;
  status: string;
  updatedAt: string;
}

/**
 * Slack thread reply result.
 */
export interface SlackThreadReplyResult {
  ok: boolean;
  channelId?: string;
  messageTs?: string;
  error?: string;
}

/**
 * Slack thread message.
 */
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

/**
 * Slack thread result.
 */
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

/**
 * Auth token structure.
 */
export interface AuthToken {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: number;
}

/**
 * Connection state.
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
