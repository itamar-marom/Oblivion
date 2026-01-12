/**
 * OblivionAgent - Main Client Class
 *
 * The primary interface for connecting AI agents to the Oblivion/Nexus platform.
 * Provides WebSocket connection, REST API access, and typed event handling.
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
 *   console.log('New task:', task.title);
 *   await agent.claimTask(task.taskId);
 * });
 *
 * agent.on('slack_message', async (msg) => {
 *   console.log('Slack message:', msg.text);
 * });
 *
 * await agent.connect();
 * ```
 */

import { EventEmitter } from 'events';
import { TokenManager } from './auth/token-manager.js';
import { HttpClient } from './api/http-client.js';
import { TaskApi } from './api/tasks.js';
import { SlackApi } from './api/slack.js';
import { SocketClient, type EventHandler } from './transport/socket-client.js';
import { ConfigError } from './utils/errors.js';
import { clientLogger } from './utils/logger.js';
import type {
  AgentConfig,
  ConnectionState,
  Task,
  AvailableTask,
  ClaimTaskResult,
  UpdateStatusResult,
  TaskUpdateStatus,
  SlackThreadReplyResult,
  SlackThreadResult,
} from './types/index.js';
import {
  EventType,
  type BaseEvent,
  type TaskAvailablePayload,
  type TaskClaimedPayload,
  type SlackMessagePayload,
  type ContextUpdatePayload,
  type WakeUpPayload,
  type StatusUpdatePayload,
  type EventPayloadMap,
} from './events/types.js';

/**
 * Event map for typed event emitter.
 */
export interface AgentEvents {
  // Connection events
  connected: [];
  disconnected: [];
  reconnecting: [];
  error: [Error];

  // Nexus events (payload only, not wrapped in BaseEvent)
  task_available: [TaskAvailablePayload];
  task_claimed: [TaskClaimedPayload];
  slack_message: [SlackMessagePayload];
  context_update: [ContextUpdatePayload];
  wake_up: [WakeUpPayload];

  // Raw event (for debugging/extension)
  event: [BaseEvent];
}

export class OblivionAgent extends EventEmitter {
  private config: AgentConfig;
  private tokenManager: TokenManager;
  private httpClient: HttpClient;
  private socketClient: SocketClient;
  private taskApi: TaskApi;
  private slackApi: SlackApi;

  constructor(config: AgentConfig) {
    super();
    this.validateConfig(config);
    this.config = config;

    // Initialize components
    this.tokenManager = new TokenManager({
      baseUrl: config.nexusUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });

    this.httpClient = new HttpClient(config.nexusUrl, this.tokenManager);

    this.socketClient = new SocketClient({
      nexusUrl: config.nexusUrl,
      tokenManager: this.tokenManager,
      autoReconnect: config.autoReconnect ?? true,
      maxReconnectAttempts: config.maxReconnectAttempts,
      reconnectDelay: config.reconnectDelay,
      capabilities: config.capabilities,
      version: config.version,
    });

    this.taskApi = new TaskApi(this.httpClient);
    this.slackApi = new SlackApi(this.httpClient);

    // Set up socket event handlers
    this.setupSocketHandlers();
  }

  // ===========================================================================
  // Connection Methods
  // ===========================================================================

  /**
   * Connect to Nexus WebSocket.
   */
  async connect(): Promise<void> {
    clientLogger.info('Connecting to Nexus...');
    await this.socketClient.connect();
  }

  /**
   * Disconnect from Nexus.
   */
  disconnect(): void {
    clientLogger.info('Disconnecting from Nexus...');
    this.socketClient.disconnect();
  }

  /**
   * Get current connection state.
   */
  getConnectionState(): ConnectionState {
    return this.socketClient.getState();
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.socketClient.getState() === 'connected';
  }

  // ===========================================================================
  // Task Methods
  // ===========================================================================

  /**
   * Get available (unclaimed) tasks.
   */
  async listAvailableTasks(): Promise<AvailableTask[]> {
    return this.taskApi.listAvailable();
  }

  /**
   * Get tasks claimed by this agent.
   */
  async listClaimedTasks(): Promise<Task[]> {
    return this.taskApi.listClaimed();
  }

  /**
   * Get a task by ClickUp ID.
   */
  async getTask(clickupTaskId: string): Promise<Task> {
    return this.taskApi.get(clickupTaskId);
  }

  /**
   * Get a task by internal ID.
   */
  async getTaskById(taskId: string): Promise<Task> {
    return this.taskApi.getById(taskId);
  }

  /**
   * Claim a task.
   */
  async claimTask(taskId: string): Promise<ClaimTaskResult> {
    clientLogger.info('Claiming task:', taskId);
    return this.taskApi.claim(taskId);
  }

  /**
   * Update task status.
   */
  async updateTaskStatus(taskId: string, status: TaskUpdateStatus): Promise<UpdateStatusResult> {
    clientLogger.info('Updating task status:', taskId, '->', status);
    return this.taskApi.updateStatus(taskId, status);
  }

  // ===========================================================================
  // Slack Methods
  // ===========================================================================

  /**
   * Post a message to a task's Slack thread.
   */
  async postToSlack(
    taskId: string,
    message: string,
    options?: { broadcast?: boolean }
  ): Promise<SlackThreadReplyResult> {
    clientLogger.info('Posting to Slack thread for task:', taskId);
    return this.slackApi.postToThread(taskId, message, options);
  }

  /**
   * Get Slack thread messages for a task.
   */
  async getSlackThread(
    taskId: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<SlackThreadResult> {
    return this.slackApi.getThread(taskId, options);
  }

  // ===========================================================================
  // Status Methods
  // ===========================================================================

  /**
   * Send a status update to Nexus.
   */
  sendStatusUpdate(status: 'idle' | 'working' | 'error', taskId?: string, message?: string): void {
    const payload: StatusUpdatePayload = { status, taskId, message };
    this.socketClient.emit(EventType.STATUS_UPDATE, payload);
  }

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  /**
   * Subscribe to a specific event type with typed payload.
   */
  on<K extends keyof AgentEvents>(
    event: K,
    listener: (...args: AgentEvents[K]) => void
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Subscribe to an event once.
   */
  once<K extends keyof AgentEvents>(
    event: K,
    listener: (...args: AgentEvents[K]) => void
  ): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  /**
   * Remove an event listener.
   */
  off<K extends keyof AgentEvents>(
    event: K,
    listener: (...args: AgentEvents[K]) => void
  ): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Validate configuration.
   */
  private validateConfig(config: AgentConfig): void {
    if (!config.nexusUrl) {
      throw new ConfigError('nexusUrl is required', 'nexusUrl');
    }
    if (!config.clientId) {
      throw new ConfigError('clientId is required', 'clientId');
    }
    if (!config.clientSecret) {
      throw new ConfigError('clientSecret is required', 'clientSecret');
    }
  }

  /**
   * Set up socket event handlers.
   */
  private setupSocketHandlers(): void {
    // Connection state changes
    this.socketClient.onStateChange((state) => {
      switch (state) {
        case 'connected':
          this.emit('connected');
          break;
        case 'disconnected':
          this.emit('disconnected');
          break;
        case 'reconnecting':
          this.emit('reconnecting');
          break;
      }
    });

    // Map socket events to agent events
    const eventMappings: Array<[EventType, keyof AgentEvents]> = [
      [EventType.TASK_AVAILABLE, 'task_available'],
      [EventType.TASK_CLAIMED, 'task_claimed'],
      [EventType.SLACK_MESSAGE, 'slack_message'],
      [EventType.CONTEXT_UPDATE, 'context_update'],
      [EventType.WAKE_UP, 'wake_up'],
    ];

    for (const [socketEvent, agentEvent] of eventMappings) {
      this.socketClient.on(socketEvent, (event: BaseEvent) => {
        clientLogger.debug('Received event:', socketEvent, event.payload);
        this.emit(agentEvent, event.payload);
        this.emit('event', event);
      });
    }

    // Also emit raw events for any event type
    this.socketClient.on('*', (event: BaseEvent) => {
      this.emit('event', event);
    });
  }
}
