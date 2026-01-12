/**
 * WebSocket Event Types and DTOs
 *
 * These define the typed event system for agent communication.
 * All events follow the pattern: { type: EventType, payload: T }
 */

/**
 * Event types for agent communication.
 * Server → Agent (downstream) and Agent → Server (upstream).
 */
export enum EventType {
  // Server → Agent
  TASK_AVAILABLE = 'task_available', // New task available for claiming
  TASK_CLAIMED = 'task_claimed', // Task was claimed by another agent
  CONTEXT_UPDATE = 'context_update',
  SLACK_MESSAGE = 'slack_message', // New message in Slack channel/thread
  WAKE_UP = 'wake_up',
  TOOL_RESULT = 'tool_result',

  // Bidirectional
  HEARTBEAT = 'heartbeat',

  // Agent → Server
  AGENT_READY = 'agent_ready',
  TOOL_REQUEST = 'tool_request',
  STATUS_UPDATE = 'status_update',
  CLAIM_TASK = 'claim_task', // Agent requests to claim a task

  // Observer Events (broadcast to tenant)
  AGENT_CONNECTED = 'agent_connected', // Agent connected to WebSocket
  AGENT_DISCONNECTED = 'agent_disconnected', // Agent disconnected
  AGENT_STATUS_CHANGED = 'agent_status_changed', // Agent status changed
}

/**
 * Base event wrapper - all events follow this structure.
 */
export interface BaseEvent<T = unknown> {
  type: EventType;
  payload: T;
  timestamp: string; // ISO 8601
}

/**
 * CONTEXT_UPDATE: New message in Slack thread.
 */
export interface ContextUpdatePayload {
  taskId: string;
  slackChannelId: string;
  slackThreadTs: string;
  messageTs: string;
  author: string;
  content: string;
  isHuman: boolean;
}

/**
 * WAKE_UP: Generic agent wake signal.
 */
export interface WakeUpPayload {
  reason: 'scheduled' | 'manual' | 'retry';
  taskId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * TOOL_REQUEST: Agent requests tool execution.
 */
export interface ToolRequestPayload {
  requestId: string;
  tool: string;
  action: string;
  params: Record<string, unknown>;
}

/**
 * TOOL_RESULT: Response from tool execution.
 */
export interface ToolResultPayload {
  requestId: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * HEARTBEAT: Keep-alive ping/pong.
 */
export interface HeartbeatPayload {
  ping?: boolean;
  pong?: boolean;
  serverTime: string;
}

/**
 * AGENT_READY: Agent signals it's ready to receive events.
 */
export interface AgentReadyPayload {
  capabilities?: string[];
  version?: string;
}

/**
 * STATUS_UPDATE: Agent updates its status.
 */
export interface StatusUpdatePayload {
  status: 'idle' | 'working' | 'error';
  taskId?: string;
  message?: string;
}

// =============================================================================
// TASK CLAIMING EVENTS (Phase 2.5)
// =============================================================================

/**
 * TASK_AVAILABLE: New task is available for claiming.
 * Sent to all agents in the project's group.
 */
export interface TaskAvailablePayload {
  taskId: string;
  projectId: string;
  projectName: string;
  groupId: string;
  groupName: string;
  clickupTaskId: string;
  slackChannelId?: string;
  slackThreadTs?: string;
  title: string;
  description?: string;
  priority: number; // 1=Urgent, 2=High, 3=Normal, 4=Low
  createdAt: string;
}

/**
 * CLAIM_TASK: Agent requests to claim a task.
 */
export interface ClaimTaskPayload {
  taskId: string;
}

/**
 * CLAIM_TASK_RESULT: Response to claim request.
 */
export interface ClaimTaskResultPayload {
  taskId: string;
  success: boolean;
  error?: string;
  claimedAt?: string;
}

/**
 * TASK_CLAIMED: Notifies other agents that a task was claimed.
 * Sent to all agents in the group except the claimer.
 */
export interface TaskClaimedPayload {
  taskId: string;
  projectId: string;
  claimedByAgentId: string;
  claimedByAgentName: string;
  claimedAt: string;
}

// =============================================================================
// OBSERVER EVENTS (Phase 3 - Real-time dashboard)
// =============================================================================

/**
 * AGENT_CONNECTED: Agent connected to WebSocket.
 * Broadcast to tenant for Observer dashboard.
 */
export interface AgentConnectedPayload {
  agentId: string;
  clientId: string;
  agentName?: string;
  connectedAt: string;
}

/**
 * AGENT_DISCONNECTED: Agent disconnected from WebSocket.
 * Broadcast to tenant for Observer dashboard.
 */
export interface AgentDisconnectedPayload {
  agentId: string;
  clientId: string;
  agentName?: string;
  disconnectedAt: string;
}

/**
 * AGENT_STATUS_CHANGED: Agent status changed.
 * Broadcast to tenant for Observer dashboard.
 */
export interface AgentStatusChangedPayload {
  agentId: string;
  clientId: string;
  agentName?: string;
  previousStatus: 'connected' | 'idle' | 'working' | 'error';
  newStatus: 'connected' | 'idle' | 'working' | 'error';
  taskId?: string;
  changedAt: string;
}

// =============================================================================
// SLACK EVENTS (Real-time Slack message notifications)
// =============================================================================

/**
 * SLACK_MESSAGE: New message posted in Slack channel or thread.
 * Broadcast to all agents in the group when message is posted.
 */
export interface SlackMessagePayload {
  channelId: string;
  messageTs: string;
  threadTs?: string;
  text: string;
  user: string;
  taskId?: string;
  taskClickupId?: string;
  projectId: string;
  projectName: string;
  groupId: string;
  groupName: string;
}

/**
 * Helper to create typed events.
 */
export function createEvent<T>(type: EventType, payload: T): BaseEvent<T> {
  return {
    type,
    payload,
    timestamp: new Date().toISOString(),
  };
}
