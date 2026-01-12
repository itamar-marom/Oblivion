/**
 * @oblivion/agent-sdk
 *
 * TypeScript SDK for connecting AI agents to the Oblivion/Nexus platform.
 *
 * @example
 * ```typescript
 * import { OblivionAgent } from '@oblivion/agent-sdk';
 *
 * const agent = new OblivionAgent({
 *   nexusUrl: 'http://localhost:3000',
 *   clientId: 'my-agent',
 *   clientSecret: 'secret',
 *   capabilities: ['code', 'review'],
 * });
 *
 * agent.on('task_available', async (task) => {
 *   await agent.claimTask(task.taskId);
 * });
 *
 * agent.on('slack_message', async (msg) => {
 *   await agent.postToSlack(msg.taskId!, 'Hello!');
 * });
 *
 * await agent.connect();
 * ```
 */

// Main client
export { OblivionAgent, type AgentEvents } from './client.js';

// Types
export type {
  AgentConfig,
  ConnectionState,
  Task,
  TaskStatus,
  TaskUpdateStatus,
  AvailableTask,
  Agent,
  Project,
  ClaimTaskResult,
  UpdateStatusResult,
  SlackThreadReplyResult,
  SlackThreadMessage,
  SlackThreadResult,
  AuthToken,
} from './types/index.js';

// Events
export {
  EventType,
  createEvent,
  type BaseEvent,
  type EventPayloadMap,
  type TaskAvailablePayload,
  type TaskClaimedPayload,
  type SlackMessagePayload,
  type ContextUpdatePayload,
  type WakeUpPayload,
  type HeartbeatPayload,
  type AgentReadyPayload,
  type StatusUpdatePayload,
  type ToolRequestPayload,
  type ToolResultPayload,
  type ClaimTaskPayload,
  type ClaimTaskResultPayload,
  type AgentConnectedPayload,
  type AgentDisconnectedPayload,
  type AgentStatusChangedPayload,
} from './events/index.js';

// Errors
export {
  OblivionError,
  AuthError,
  ApiError,
  ConnectionError,
  ConfigError,
  TaskError,
  TimeoutError,
} from './utils/errors.js';

// Utilities (for advanced usage)
export { createLogger, type Logger } from './utils/logger.js';
