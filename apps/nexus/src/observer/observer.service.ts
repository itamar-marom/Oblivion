import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UpdateAgentDto } from './dto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService, AgentConnection } from '../gateway/redis.service';

/**
 * Activity event for the dashboard.
 */
export interface ActivityEvent {
  id: string;
  type: 'task_created' | 'task_claimed' | 'agent_connected' | 'agent_disconnected' | 'status_change';
  timestamp: string;
  agentId?: string;
  agentName?: string;
  taskId?: string;
  taskTitle?: string | null;
  projectName?: string;
  details?: string;
}

/**
 * Dashboard statistics.
 */
export interface DashboardStats {
  connectedAgents: number;
  totalAgents: number;
  activeTasks: number;
  pendingTasks: number;
  totalGroups: number;
  totalProjects: number;
}

/**
 * Agent with connection status.
 */
export interface AgentWithStatus {
  id: string;
  name: string;
  description: string | null;
  clientId: string;
  email: string | null;
  avatarUrl: string | null;
  slackUserId: string | null;
  capabilities: string[];
  isActive: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  // Connection status from Redis
  isConnected: boolean;
  connectionStatus: AgentConnection['status'] | 'offline';
  connectedAt?: string;
}

/**
 * Observer Service.
 *
 * Provides aggregated data for the Observer dashboard:
 * - Dashboard statistics
 * - Agent listing with real-time connection status
 * - Recent activity events
 */
@Injectable()
export class ObserverService {
  private readonly logger = new Logger(ObserverService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  /**
   * Get dashboard statistics for a tenant.
   */
  async getStats(tenantId: string): Promise<DashboardStats> {
    // Run queries in parallel
    const [
      connectedAgentIds,
      totalAgents,
      activeTasks,
      pendingTasks,
      totalGroups,
      totalProjects,
    ] = await Promise.all([
      this.redisService.getConnectedAgentsForTenant(tenantId),
      this.prisma.agent.count({
        where: { tenantId, isActive: true },
      }),
      this.prisma.task.count({
        where: {
          project: { tenantId },
          status: { in: ['CLAIMED', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.task.count({
        where: {
          project: { tenantId },
          status: 'TODO',
        },
      }),
      this.prisma.group.count({
        where: { tenantId, isActive: true },
      }),
      this.prisma.project.count({
        where: { tenantId, isActive: true },
      }),
    ]);

    return {
      connectedAgents: connectedAgentIds.length,
      totalAgents,
      activeTasks,
      pendingTasks,
      totalGroups,
      totalProjects,
    };
  }

  /**
   * Get all agents for a tenant with their connection status.
   */
  async getAgents(tenantId: string): Promise<AgentWithStatus[]> {
    // Get all agents from database
    const agents = await this.prisma.agent.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    // Get connected agent IDs from Redis
    const connectedAgentIds = await this.redisService.getConnectedAgentsForTenant(tenantId);
    const connectedSet = new Set(connectedAgentIds);

    // Get detailed connection info for connected agents
    const connectionInfo = new Map<string, AgentConnection>();
    for (const agentId of connectedAgentIds) {
      const socketId = await this.redisService.getSocketIdForAgent(agentId);
      if (socketId) {
        const conn = await this.redisService.getConnectionBySocket(socketId);
        if (conn) {
          connectionInfo.set(agentId, conn);
        }
      }
    }

    return agents.map((agent) => {
      const conn = connectionInfo.get(agent.id);
      return {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        clientId: agent.clientId,
        email: agent.email,
        avatarUrl: agent.avatarUrl,
        slackUserId: agent.slackUserId,
        capabilities: agent.capabilities as string[],
        isActive: agent.isActive,
        lastSeenAt: agent.lastSeenAt,
        createdAt: agent.createdAt,
        isConnected: connectedSet.has(agent.id),
        connectionStatus: conn?.status || 'offline',
        connectedAt: conn?.connectedAt,
      };
    });
  }

  /**
   * Get a single agent by ID with connection status.
   */
  async getAgent(tenantId: string, agentId: string): Promise<AgentWithStatus> {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // Get connection status from Redis
    const socketId = await this.redisService.getSocketIdForAgent(agentId);
    let conn: AgentConnection | null = null;
    if (socketId) {
      conn = await this.redisService.getConnectionBySocket(socketId);
    }

    return {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      clientId: agent.clientId,
      email: agent.email,
      avatarUrl: agent.avatarUrl,
      slackUserId: agent.slackUserId,
      capabilities: agent.capabilities as string[],
      isActive: agent.isActive,
      lastSeenAt: agent.lastSeenAt,
      createdAt: agent.createdAt,
      isConnected: !!conn,
      connectionStatus: conn?.status || 'offline',
      connectedAt: conn?.connectedAt,
    };
  }

  /**
   * Update an agent's profile.
   */
  async updateAgent(tenantId: string, agentId: string, dto: UpdateAgentDto): Promise<AgentWithStatus> {
    // Verify agent exists and belongs to tenant
    const existing = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Agent not found');
    }

    // Update the agent
    const agent = await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.slackUserId !== undefined && { slackUserId: dto.slackUserId }),
        ...(dto.capabilities && { capabilities: dto.capabilities }),
      },
    });

    this.logger.log(`Agent "${agent.name}" updated by Observer`);

    // Get connection status from Redis
    const socketId = await this.redisService.getSocketIdForAgent(agentId);
    let conn: AgentConnection | null = null;
    if (socketId) {
      conn = await this.redisService.getConnectionBySocket(socketId);
    }

    return {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      clientId: agent.clientId,
      email: agent.email,
      avatarUrl: agent.avatarUrl,
      slackUserId: agent.slackUserId,
      capabilities: agent.capabilities as string[],
      isActive: agent.isActive,
      lastSeenAt: agent.lastSeenAt,
      createdAt: agent.createdAt,
      isConnected: !!conn,
      connectionStatus: conn?.status || 'offline',
      connectedAt: conn?.connectedAt,
    };
  }

  /**
   * Get recent activity events for a tenant.
   *
   * Combines data from tasks and logs recent events.
   * In the future, this could be backed by an events table or Redis stream.
   */
  async getActivity(tenantId: string, limit = 50): Promise<ActivityEvent[]> {
    // Get recent tasks with their claim history
    const recentTasks = await this.prisma.task.findMany({
      where: {
        project: { tenantId },
      },
      include: {
        project: {
          select: { name: true },
        },
        claimedByAgent: {
          select: { id: true, name: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    const events: ActivityEvent[] = [];

    for (const task of recentTasks) {
      // Task creation event
      events.push({
        id: `task-created-${task.id}`,
        type: 'task_created',
        timestamp: task.createdAt.toISOString(),
        taskId: task.id,
        taskTitle: task.title,
        projectName: task.project.name,
        details: `Task created in ${task.project.name}`,
      });

      // Task claimed event
      if (task.claimedByAgent && task.claimedAt) {
        events.push({
          id: `task-claimed-${task.id}`,
          type: 'task_claimed',
          timestamp: task.claimedAt.toISOString(),
          agentId: task.claimedByAgent.id,
          agentName: task.claimedByAgent.name,
          taskId: task.id,
          taskTitle: task.title,
          projectName: task.project.name,
          details: `${task.claimedByAgent.name} claimed "${task.title}"`,
        });
      }
    }

    // Sort by timestamp descending and limit
    return events
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Get tasks grouped by status for queue visualization.
   */
  async getTaskQueue(tenantId: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        project: { tenantId },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            group: {
              select: { id: true, name: true },
            },
          },
        },
        claimedByAgent: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    return {
      todo: tasks.filter((t) => t.status === 'TODO'),
      claimed: tasks.filter((t) => t.status === 'CLAIMED'),
      inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS'),
      done: tasks.filter((t) => t.status === 'DONE'),
    };
  }
}
