/**
 * Socket Client
 *
 * Socket.io wrapper for WebSocket communication with Nexus.
 * Handles connection, reconnection, and event dispatching.
 */

import { io, Socket } from 'socket.io-client';
import type { TokenManager } from '../auth/token-manager.js';
import type { ConnectionState } from '../types/index.js';
import { ConnectionError } from '../utils/errors.js';
import { socketLogger } from '../utils/logger.js';
import {
  EventType,
  type BaseEvent,
  type HeartbeatPayload,
  type AgentReadyPayload,
} from '../events/types.js';

export interface SocketClientConfig {
  nexusUrl: string;
  tokenManager: TokenManager;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  capabilities?: string[];
  version?: string;
}

export type EventHandler<T = unknown> = (event: BaseEvent<T>) => void | Promise<void>;

export class SocketClient {
  private config: SocketClientConfig;
  private socket: Socket | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private stateHandlers: Set<(state: ConnectionState) => void> = new Set();

  constructor(config: SocketClientConfig) {
    this.config = {
      autoReconnect: true,
      maxReconnectAttempts: 10,
      reconnectDelay: 1000,
      ...config,
    };
  }

  /**
   * Get current connection state.
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Subscribe to state changes.
   */
  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  /**
   * Subscribe to events by type.
   */
  on<T = unknown>(eventType: EventType | string, handler: EventHandler<T>): () => void {
    const handlers = this.eventHandlers.get(eventType) ?? new Set();
    handlers.add(handler as EventHandler);
    this.eventHandlers.set(eventType, handlers);

    return () => {
      const h = this.eventHandlers.get(eventType);
      if (h) {
        h.delete(handler as EventHandler);
        if (h.size === 0) {
          this.eventHandlers.delete(eventType);
        }
      }
    };
  }

  /**
   * Connect to Nexus WebSocket.
   */
  async connect(): Promise<void> {
    if (this.socket?.connected) {
      socketLogger.debug('Already connected');
      return;
    }

    this.setState('connecting');
    socketLogger.debug('Connecting to Nexus WebSocket...');

    const token = await this.config.tokenManager.getToken();

    // Parse URL and construct WebSocket URL
    const url = new URL(this.config.nexusUrl);
    const wsUrl = `${url.protocol}//${url.host}`;

    return new Promise<void>((resolve, reject) => {
      this.socket = io(`${wsUrl}/agents`, {
        query: { token },
        transports: ['websocket'],
        reconnection: false, // We handle reconnection ourselves
        timeout: 10000,
      });

      const connectTimeout = setTimeout(() => {
        if (this.state === 'connecting') {
          this.socket?.disconnect();
          reject(new ConnectionError('Connection timeout'));
        }
      }, 15000);

      this.socket.on('connect', () => {
        clearTimeout(connectTimeout);
        socketLogger.info('Connected to Nexus WebSocket');
        this.setState('connected');
        this.reconnectAttempts = 0;

        // Send AGENT_READY event
        this.sendAgentReady();
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        socketLogger.warn('Disconnected from Nexus:', reason);
        this.handleDisconnect(reason);
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(connectTimeout);
        socketLogger.error('Connection error:', error.message);

        if (this.state === 'connecting') {
          this.setState('disconnected');
          reject(new ConnectionError(error.message));
        } else {
          this.handleDisconnect('error');
        }
      });

      // Listen for all events and dispatch to handlers
      this.socket.onAny((eventName: string, data: unknown) => {
        socketLogger.debug('Received event:', eventName, data);
        this.dispatchEvent(eventName, data as BaseEvent);
      });
    });
  }

  /**
   * Disconnect from Nexus.
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.setState('disconnected');
    socketLogger.info('Disconnected from Nexus');
  }

  /**
   * Send an event to the server.
   */
  emit<T>(type: EventType, payload: T): void {
    if (!this.socket?.connected) {
      throw new ConnectionError('Not connected to Nexus');
    }

    const event: BaseEvent<T> = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    socketLogger.debug('Emitting event:', type, payload);
    this.socket.emit(type, event);
  }

  /**
   * Send AGENT_READY event.
   */
  private sendAgentReady(): void {
    const payload: AgentReadyPayload = {
      capabilities: this.config.capabilities,
      version: this.config.version ?? '0.1.0',
    };

    this.emit(EventType.AGENT_READY, payload);
  }

  /**
   * Handle heartbeat events.
   */
  private handleHeartbeat(payload: HeartbeatPayload): void {
    if (payload.ping) {
      socketLogger.debug('Received heartbeat ping, sending pong');
      this.emit(EventType.HEARTBEAT, {
        pong: true,
        serverTime: new Date().toISOString(),
      });
    }
  }

  /**
   * Dispatch event to registered handlers.
   */
  private async dispatchEvent(eventName: string, event: BaseEvent): Promise<void> {
    // Handle heartbeat internally
    if (eventName === EventType.HEARTBEAT) {
      this.handleHeartbeat(event.payload as HeartbeatPayload);
    }

    // Dispatch to registered handlers
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (error) {
          socketLogger.error('Event handler error:', error);
        }
      }
    }

    // Also dispatch to wildcard handlers
    const wildcardHandlers = this.eventHandlers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          await handler(event);
        } catch (error) {
          socketLogger.error('Wildcard handler error:', error);
        }
      }
    }
  }

  /**
   * Handle disconnect and trigger reconnection if enabled.
   */
  private handleDisconnect(reason: string): void {
    this.socket = null;

    if (
      this.config.autoReconnect &&
      this.reconnectAttempts < (this.config.maxReconnectAttempts ?? 10)
    ) {
      this.scheduleReconnect();
    } else {
      this.setState('disconnected');
    }
  }

  /**
   * Schedule a reconnection attempt.
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.setState('reconnecting');
    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    // Plus random jitter (0-1s) to prevent thundering herd on mass reconnection
    const baseDelay = Math.min(
      (this.config.reconnectDelay ?? 1000) * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );
    const jitter = Math.random() * 1000; // 0-1s random jitter
    const delay = Math.round(baseDelay + jitter);

    socketLogger.info(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;

      try {
        await this.connect();
      } catch (error) {
        socketLogger.error('Reconnection failed:', error);
        this.handleDisconnect('reconnect_failed');
      }
    }, delay);
  }

  /**
   * Update connection state and notify handlers.
   */
  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      socketLogger.debug('State changed:', this.state, '->', state);
      this.state = state;

      for (const handler of this.stateHandlers) {
        try {
          handler(state);
        } catch (error) {
          socketLogger.error('State handler error:', error);
        }
      }
    }
  }
}
