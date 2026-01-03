import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { RedisService, AgentConnection } from './redis.service';
import { EventType, createEvent } from './dto/events.dto';
import type {
  BaseEvent,
  HeartbeatPayload,
  AgentReadyPayload,
  StatusUpdatePayload,
  ToolRequestPayload,
  ClaimTaskPayload,
  ClaimTaskResultPayload,
} from './dto/events.dto';

/**
 * JWT payload structure from auth module.
 */
interface JwtPayload {
  sub: string; // agent ID
  clientId: string;
  tenantId: string;
}

/**
 * Extended socket with agent context.
 */
interface AuthenticatedSocket extends Socket {
  agentId?: string;
  tenantId?: string;
  clientId?: string;
}

/**
 * AgentGateway handles WebSocket connections from AI agents.
 *
 * Features:
 * - JWT authentication in handshake
 * - Connection/disconnection tracking via Redis
 * - Heartbeat (30s ping/pong)
 * - Event emission to specific agents or all tenant agents
 *
 * Connection flow:
 * 1. Agent connects with JWT in query params: ?token=<jwt>
 * 2. Gateway validates JWT and extracts agent identity
 * 3. Connection registered in Redis for cross-pod awareness
 * 4. Agent receives events and responds with heartbeats
 */
/**
 * Callback type for handling task claims.
 * Set by TasksService to avoid circular dependency.
 */
type ClaimTaskHandler = (
  agentId: string,
  taskId: string,
) => Promise<ClaimTaskResultPayload>;

@WebSocketGateway({
  namespace: '/agents',
  cors: {
    origin: '*', // Tighten in production
    credentials: true,
  },
  pingInterval: 30000, // 30s ping interval
  pingTimeout: 10000, // 10s timeout for pong
})
export class AgentGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private claimTaskHandler: ClaimTaskHandler | null = null;

  constructor(
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  /**
   * Register a handler for task claims.
   * Called by TasksService during initialization.
   */
  setClaimTaskHandler(handler: ClaimTaskHandler) {
    this.claimTaskHandler = handler;
  }

  /**
   * Called when the gateway initializes.
   */
  afterInit() {
    console.log('WebSocket Gateway initialized on /agents namespace');
  }

  /**
   * Handle new agent connections.
   * Validates JWT and registers connection in Redis.
   */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract token from query params
      const token = client.handshake.query.token as string;
      if (!token) {
        console.log(`Connection rejected: No token provided (${client.id})`);
        client.disconnect(true);
        return;
      }

      // Validate JWT
      let payload: JwtPayload;
      try {
        payload = this.jwtService.verify<JwtPayload>(token);
      } catch {
        console.log(`Connection rejected: Invalid token (${client.id})`);
        client.disconnect(true);
        return;
      }

      // Store agent context on socket
      client.agentId = payload.sub;
      client.tenantId = payload.tenantId;
      client.clientId = payload.clientId;

      // Register connection in Redis
      const connection: AgentConnection = {
        agentId: payload.sub,
        socketId: client.id,
        tenantId: payload.tenantId,
        clientId: payload.clientId,
        connectedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        status: 'connected',
      };

      await this.redisService.registerConnection(connection);

      // Join tenant room for broadcast
      client.join(`tenant:${payload.tenantId}`);

      console.log(
        `Agent connected: ${payload.clientId} (socket: ${client.id}, tenant: ${payload.tenantId})`,
      );

      // Send welcome acknowledgment
      client.emit('connected', {
        message: 'Connected to Nexus',
        agentId: payload.sub,
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`Connection error: ${error}`);
      client.disconnect(true);
    }
  }

  /**
   * Handle agent disconnections.
   */
  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.agentId) {
      const connection = await this.redisService.removeConnection(client.id);
      if (connection) {
        console.log(
          `Agent disconnected: ${connection.clientId} (socket: ${client.id})`,
        );
      }
    }
  }

  /**
   * Handle heartbeat messages from agents.
   */
  @SubscribeMessage(EventType.HEARTBEAT)
  async handleHeartbeat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: BaseEvent<HeartbeatPayload>,
  ): Promise<BaseEvent<HeartbeatPayload>> {
    await this.redisService.updateHeartbeat(client.id);

    return createEvent(EventType.HEARTBEAT, {
      pong: true,
      serverTime: new Date().toISOString(),
    });
  }

  /**
   * Handle agent ready signal.
   */
  @SubscribeMessage(EventType.AGENT_READY)
  async handleAgentReady(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: BaseEvent<AgentReadyPayload>,
  ) {
    await this.redisService.updateHeartbeat(client.id, 'idle');

    console.log(
      `Agent ready: ${client.clientId} (capabilities: ${data.payload.capabilities?.join(', ') || 'none'})`,
    );

    return { acknowledged: true };
  }

  /**
   * Handle status updates from agents.
   */
  @SubscribeMessage(EventType.STATUS_UPDATE)
  async handleStatusUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: BaseEvent<StatusUpdatePayload>,
  ) {
    const statusMap: Record<string, AgentConnection['status']> = {
      idle: 'idle',
      working: 'working',
      error: 'error',
    };

    await this.redisService.updateHeartbeat(
      client.id,
      statusMap[data.payload.status],
    );

    console.log(
      `Agent status: ${client.clientId} → ${data.payload.status}${data.payload.taskId ? ` (task: ${data.payload.taskId})` : ''}`,
    );

    return { acknowledged: true };
  }

  /**
   * Handle tool execution requests from agents.
   * (Will be processed by Tool Gateway in future phases)
   */
  @SubscribeMessage(EventType.TOOL_REQUEST)
  async handleToolRequest(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: BaseEvent<ToolRequestPayload>,
  ) {
    console.log(
      `Tool request from ${client.clientId}: ${data.payload.tool}.${data.payload.action}`,
    );

    // TODO: Phase 2 - Route to Tool Gateway
    // For now, return a placeholder response
    return createEvent(EventType.TOOL_RESULT, {
      requestId: data.payload.requestId,
      success: false,
      error: 'Tool Gateway not implemented yet',
    });
  }

  /**
   * Handle task claim requests from agents.
   * Agent attempts to claim an available task.
   */
  @SubscribeMessage(EventType.CLAIM_TASK)
  async handleClaimTask(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: BaseEvent<ClaimTaskPayload>,
  ): Promise<ClaimTaskResultPayload> {
    if (!client.agentId) {
      return {
        taskId: data.payload.taskId,
        success: false,
        error: 'Not authenticated',
      };
    }

    if (!this.claimTaskHandler) {
      return {
        taskId: data.payload.taskId,
        success: false,
        error: 'Task claiming not available',
      };
    }

    console.log(
      `Claim request from ${client.clientId} for task ${data.payload.taskId}`,
    );

    return this.claimTaskHandler(client.agentId, data.payload.taskId);
  }

  // ==========================================================================
  // Event Emission Methods (called by other services)
  // ==========================================================================

  /**
   * Emit event to a specific agent by ID.
   */
  async emitToAgent<T>(agentId: string, event: BaseEvent<T>): Promise<boolean> {
    const socketId = await this.redisService.getSocketIdForAgent(agentId);
    if (!socketId) {
      console.log(`Cannot emit to agent ${agentId}: not connected`);
      return false;
    }

    this.server.to(socketId).emit(event.type, event);
    return true;
  }

  /**
   * Emit event to all connected agents in a tenant.
   */
  async emitToTenant<T>(tenantId: string, event: BaseEvent<T>): Promise<void> {
    this.server.to(`tenant:${tenantId}`).emit(event.type, event);
  }

  /**
   * Emit event to multiple specific agents.
   */
  async emitToAgents<T>(agentIds: string[], event: BaseEvent<T>): Promise<void> {
    for (const agentId of agentIds) {
      await this.emitToAgent(agentId, event);
    }
  }

  /**
   * Check if an agent is currently connected.
   */
  async isAgentConnected(agentId: string): Promise<boolean> {
    return this.redisService.isAgentConnected(agentId);
  }

  /**
   * Get all connected agents for a tenant.
   */
  async getConnectedAgents(tenantId: string): Promise<string[]> {
    return this.redisService.getConnectedAgentsForTenant(tenantId);
  }
}
