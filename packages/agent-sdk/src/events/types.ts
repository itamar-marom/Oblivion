/**
 * WebSocket Event Types and DTOs
 *
 * These define the typed event system for agent communication.
 * All events follow the pattern: { type: EventType, payload: T }
 */

/**
 * Event types for agent communication.
 * Server -> Agent (downstream) and Agent -> Server (upstream).
 */
export enum EventType {
  // Server -> Agent
  TASK_AVAILABLE = 'task_available',
  TASK_CLAIMED = 'task_claimed',
  CONTEXT_UPDATE = 'context_update',
  SLACK_MESSAGE = 'slack_message',
  WAKE_UP = 'wake_up',
  TOOL_RESULT = 'tool_result',

  // Bidirectional
  HEARTBEAT = 'heartbeat',

  // Agent -> Server
  AGENT_READY = 'agent_ready',
  TOOL_REQUEST = 'tool_request',
  STATUS_UPDATE = 'status_update',
  CLAIM_TASK = 'claim_task',

  // Observer Events
  AGENT_CONNECTED = 'agent_connected',
  AGENT_DISCONNECTED = 'agent_disconnected',
  AGENT_STATUS_CHANGED = 'agent_status_changed',
}

/**
 * Base event wrapper - all events follow this structure.
 */
export interface BaseEvent<T = unknown> {
  type: EventType;
  payload: T;
  timestamp: string;
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

/**
 * TASK_AVAILABLE: New task is available for claiming.
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
  priority: number;
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
 */
export interface TaskClaimedPayload {
  taskId: string;
  projectId: string;
  claimedByAgentId: string;
  claimedByAgentName: string;
  claimedAt: string;
}

/**
 * AGENT_CONNECTED: Agent connected to WebSocket.
 */
export interface AgentConnectedPayload {
  agentId: string;
  clientId: string;
  agentName?: string;
  connectedAt: string;
}

/**
 * AGENT_DISCONNECTED: Agent disconnected from WebSocket.
 */
export interface AgentDisconnectedPayload {
  agentId: string;
  clientId: string;
  agentName?: string;
  disconnectedAt: string;
}

/**
 * AGENT_STATUS_CHANGED: Agent status changed.
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

/**
 * SLACK_MESSAGE: New message posted in Slack channel or thread.
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

/**
 * Map of event types to their payload types for type inference.
 */
export interface EventPayloadMap {
  [EventType.TASK_AVAILABLE]: TaskAvailablePayload;
  [EventType.TASK_CLAIMED]: TaskClaimedPayload;
  [EventType.CONTEXT_UPDATE]: ContextUpdatePayload;
  [EventType.SLACK_MESSAGE]: SlackMessagePayload;
  [EventType.WAKE_UP]: WakeUpPayload;
  [EventType.TOOL_RESULT]: ToolResultPayload;
  [EventType.HEARTBEAT]: HeartbeatPayload;
  [EventType.AGENT_READY]: AgentReadyPayload;
  [EventType.TOOL_REQUEST]: ToolRequestPayload;
  [EventType.STATUS_UPDATE]: StatusUpdatePayload;
  [EventType.CLAIM_TASK]: ClaimTaskPayload;
  [EventType.AGENT_CONNECTED]: AgentConnectedPayload;
  [EventType.AGENT_DISCONNECTED]: AgentDisconnectedPayload;
  [EventType.AGENT_STATUS_CHANGED]: AgentStatusChangedPayload;
}
