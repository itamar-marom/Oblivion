import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Agent connection info stored in Redis.
 */
export interface AgentConnection {
  agentId: string;
  socketId: string;
  tenantId: string;
  clientId: string;
  connectedAt: string;
  lastSeen: string;
  status: 'connected' | 'idle' | 'working' | 'error';
}

/**
 * RedisService manages socket-to-agent mappings for the WebSocket Gateway.
 *
 * Key patterns:
 * - socket:{socketId} → AgentConnection (JSON)
 * - agent:{agentId} → socketId
 * - tenant:{tenantId}:agents → Set of agentIds
 *
 * TTL: 5 minutes (renewed on heartbeat)
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private readonly CONNECTION_TTL = 300; // 5 minutes

  async onModuleInit() {
    this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    this.client.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis connected for WebSocket gateway');
    });
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  /**
   * Register a new agent connection.
   */
  async registerConnection(connection: AgentConnection): Promise<void> {
    const { socketId, agentId, tenantId } = connection;

    // Store socket → agent mapping
    await this.client.setex(
      `socket:${socketId}`,
      this.CONNECTION_TTL,
      JSON.stringify(connection),
    );

    // Store agent → socket mapping (for sending events to specific agent)
    await this.client.setex(`agent:${agentId}`, this.CONNECTION_TTL, socketId);

    // Add to tenant's active agents set
    await this.client.sadd(`tenant:${tenantId}:agents`, agentId);
  }

  /**
   * Remove an agent connection (on disconnect).
   */
  async removeConnection(socketId: string): Promise<AgentConnection | null> {
    const data = await this.client.get(`socket:${socketId}`);
    if (!data) return null;

    const connection: AgentConnection = JSON.parse(data);

    // Clean up all mappings
    await this.client.del(`socket:${socketId}`);
    await this.client.del(`agent:${connection.agentId}`);
    await this.client.srem(
      `tenant:${connection.tenantId}:agents`,
      connection.agentId,
    );

    return connection;
  }

  /**
   * Get connection info by socket ID.
   */
  async getConnectionBySocket(socketId: string): Promise<AgentConnection | null> {
    const data = await this.client.get(`socket:${socketId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get socket ID for an agent (to send events).
   */
  async getSocketIdForAgent(agentId: string): Promise<string | null> {
    return this.client.get(`agent:${agentId}`);
  }

  /**
   * Get all connected agents for a tenant.
   */
  async getConnectedAgentsForTenant(tenantId: string): Promise<string[]> {
    return this.client.smembers(`tenant:${tenantId}:agents`);
  }

  /**
   * Update last seen time and status (heartbeat).
   */
  async updateHeartbeat(socketId: string, status?: AgentConnection['status']): Promise<void> {
    const data = await this.client.get(`socket:${socketId}`);
    if (!data) return;

    const connection: AgentConnection = JSON.parse(data);
    connection.lastSeen = new Date().toISOString();
    if (status) connection.status = status;

    // Renew TTL on heartbeat
    await this.client.setex(
      `socket:${socketId}`,
      this.CONNECTION_TTL,
      JSON.stringify(connection),
    );
    await this.client.expire(`agent:${connection.agentId}`, this.CONNECTION_TTL);
  }

  /**
   * Check if an agent is connected.
   */
  async isAgentConnected(agentId: string): Promise<boolean> {
    const socketId = await this.client.get(`agent:${agentId}`);
    return socketId !== null;
  }

  /**
   * Get Redis client for pub/sub (used for multi-pod scaling).
   */
  getClient(): Redis {
    return this.client;
  }
}
