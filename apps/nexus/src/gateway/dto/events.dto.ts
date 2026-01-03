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
  TASK_ASSIGNED = 'task_assigned',
  CONTEXT_UPDATE = 'context_update',
  WAKE_UP = 'wake_up',
  TOOL_RESULT = 'tool_result',

  // Bidirectional
  HEARTBEAT = 'heartbeat',

  // Agent → Server
  AGENT_READY = 'agent_ready',
  TOOL_REQUEST = 'tool_request',
  STATUS_UPDATE = 'status_update',
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
 * TASK_ASSIGNED: New task from ClickUp assigned to agent.
 */
export interface TaskAssignedPayload {
  taskId: string;
  projectMappingId: string;
  clickupTaskId: string;
  slackChannelId: string;
  slackThreadTs: string;
  title: string;
  description?: string;
  assignedAt: string;
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
 * Helper to create typed events.
 */
export function createEvent<T>(type: EventType, payload: T): BaseEvent<T> {
  return {
    type,
    payload,
    timestamp: new Date().toISOString(),
  };
}
