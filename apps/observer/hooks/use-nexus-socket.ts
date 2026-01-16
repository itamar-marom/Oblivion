"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/contexts/auth-context";
import { getToken } from "@/lib/api-client";
import type { ActivityEvent } from "@/lib/types";

/**
 * WebSocket Event Types (from Nexus)
 */
export type EventType =
  | "agent_connected"
  | "agent_disconnected"
  | "agent_status_changed"
  | "task_available"
  | "task_claimed";

/**
 * Agent Connected Event Payload
 */
export interface AgentConnectedPayload {
  agentId: string;
  clientId: string;
  agentName?: string;
  connectedAt: string;
}

/**
 * Agent Disconnected Event Payload
 */
export interface AgentDisconnectedPayload {
  agentId: string;
  clientId: string;
  agentName?: string;
  disconnectedAt: string;
}

/**
 * Agent Status Changed Event Payload
 */
export interface AgentStatusChangedPayload {
  agentId: string;
  clientId: string;
  agentName?: string;
  previousStatus: "connected" | "idle" | "working" | "error";
  newStatus: "connected" | "idle" | "working" | "error";
  taskId?: string;
  changedAt: string;
}

/**
 * Task Available Event Payload
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
 * Task Claimed Event Payload
 */
export interface TaskClaimedPayload {
  taskId: string;
  projectId: string;
  claimedByAgentId: string;
  claimedByAgentName: string;
  claimedAt: string;
}

/**
 * Base event wrapper
 */
export interface BaseEvent<T> {
  type: EventType;
  payload: T;
  timestamp: string;
}

/**
 * Callback handlers for WebSocket events
 */
export interface WebSocketEventHandlers {
  onAgentConnected?: (payload: AgentConnectedPayload) => void;
  onAgentDisconnected?: (payload: AgentDisconnectedPayload) => void;
  onAgentStatusChanged?: (payload: AgentStatusChangedPayload) => void;
  onTaskAvailable?: (payload: TaskAvailablePayload) => void;
  onTaskClaimed?: (payload: TaskClaimedPayload) => void;
  onActivity?: (event: ActivityEvent) => void;
}

interface UseNexusSocketReturn {
  connected: boolean;
  error: string | null;
  reconnecting: boolean;
}

const NEXUS_WS_URL = process.env.NEXT_PUBLIC_NEXUS_WS_URL || "http://localhost:3000";

/**
 * Transform WebSocket events to ActivityEvent format
 */
function createActivityFromEvent(
  type: EventType,
  payload: unknown
): ActivityEvent {
  const id = `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = new Date().toISOString();

  switch (type) {
    case "agent_connected": {
      const p = payload as AgentConnectedPayload;
      return {
        id,
        timestamp,
        type: "agent_connected",
        source: "agent",
        message: `${p.agentName || p.clientId} connected`,
        metadata: { agentId: p.agentId },
      };
    }
    case "agent_disconnected": {
      const p = payload as AgentDisconnectedPayload;
      return {
        id,
        timestamp,
        type: "agent_disconnected",
        source: "agent",
        message: `${p.agentName || p.clientId} disconnected`,
        metadata: { agentId: p.agentId },
      };
    }
    case "agent_status_changed": {
      const p = payload as AgentStatusChangedPayload;
      return {
        id,
        timestamp,
        type: "status_change",
        source: "agent",
        message: `${p.agentName || p.clientId} status: ${p.previousStatus} → ${p.newStatus}${p.taskId ? ` (task)` : ""}`,
        metadata: { agentId: p.agentId, taskId: p.taskId },
      };
    }
    case "task_available": {
      const p = payload as TaskAvailablePayload;
      return {
        id,
        timestamp,
        type: "task_available",
        source: "system",
        message: `Task available: ${p.title} in ${p.projectName}`,
        metadata: { taskId: p.taskId, projectId: p.projectId },
      };
    }
    case "task_claimed": {
      const p = payload as TaskClaimedPayload;
      return {
        id,
        timestamp,
        type: "task_claimed",
        source: "agent",
        message: `${p.claimedByAgentName} claimed task`,
        metadata: { taskId: p.taskId, agentId: p.claimedByAgentId },
      };
    }
    default:
      return {
        id,
        timestamp,
        type: "status_update",
        source: "system",
        message: `Unknown event: ${type}`,
      };
  }
}

/**
 * Hook for connecting to Nexus WebSocket and receiving real-time events.
 *
 * Features:
 * - Connects to /agents namespace with JWT token
 * - Auto-reconnects on disconnect
 * - Transforms events to ActivityEvent format
 * - Provides callbacks for specific event types
 */
export function useNexusSocket(handlers: WebSocketEventHandlers = {}): UseNexusSocketReturn {
  const { isAuthenticated } = useAuth();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);

  // Keep handlers ref updated
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  /**
   * Handle incoming events
   */
  const handleEvent = useCallback((type: EventType, event: BaseEvent<unknown>) => {
    const payload = event.payload;
    const h = handlersRef.current;

    // Create activity event and call onActivity
    if (h.onActivity) {
      const activity = createActivityFromEvent(type, payload);
      h.onActivity(activity);
    }

    // Call specific handlers
    switch (type) {
      case "agent_connected":
        h.onAgentConnected?.(payload as AgentConnectedPayload);
        break;
      case "agent_disconnected":
        h.onAgentDisconnected?.(payload as AgentDisconnectedPayload);
        break;
      case "agent_status_changed":
        h.onAgentStatusChanged?.(payload as AgentStatusChangedPayload);
        break;
      case "task_available":
        h.onTaskAvailable?.(payload as TaskAvailablePayload);
        break;
      case "task_claimed":
        h.onTaskClaimed?.(payload as TaskClaimedPayload);
        break;
    }
  }, []);

  /**
   * Connect to WebSocket
   */
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const token = getToken();
    if (!token) {
      // Schedule setState to avoid synchronous call in effect
      Promise.resolve().then(() => setError("No auth token available"));
      return;
    }

    // Create socket connection
    const socket = io(`${NEXUS_WS_URL}/agents`, {
      query: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on("connect", () => {
      console.log("[WebSocket] Connected to Nexus");
      setConnected(true);
      setError(null);
      setReconnecting(false);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[WebSocket] Disconnected: ${reason}`);
      setConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("[WebSocket] Connection error:", err.message);
      setError(err.message);
      setConnected(false);
    });

    socket.on("reconnecting", (attempt) => {
      console.log(`[WebSocket] Reconnecting... attempt ${attempt}`);
      setReconnecting(true);
    });

    socket.on("reconnect", () => {
      console.log("[WebSocket] Reconnected");
      setReconnecting(false);
    });

    socket.on("reconnect_failed", () => {
      console.log("[WebSocket] Reconnection failed");
      setReconnecting(false);
      setError("Failed to reconnect to Nexus");
    });

    // Welcome message from server
    socket.on("connected", (data: { message: string; agentId: string }) => {
      console.log(`[WebSocket] ${data.message} (agentId: ${data.agentId})`);
    });

    // Observer events
    socket.on("agent_connected", (event: BaseEvent<AgentConnectedPayload>) => {
      handleEvent("agent_connected", event);
    });

    socket.on("agent_disconnected", (event: BaseEvent<AgentDisconnectedPayload>) => {
      handleEvent("agent_disconnected", event);
    });

    socket.on("agent_status_changed", (event: BaseEvent<AgentStatusChangedPayload>) => {
      handleEvent("agent_status_changed", event);
    });

    socket.on("task_available", (event: BaseEvent<TaskAvailablePayload>) => {
      handleEvent("task_available", event);
    });

    socket.on("task_claimed", (event: BaseEvent<TaskClaimedPayload>) => {
      handleEvent("task_claimed", event);
    });

    // Cleanup on unmount
    return () => {
      console.log("[WebSocket] Disconnecting...");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, handleEvent]);

  return {
    connected,
    error,
    reconnecting,
  };
}
