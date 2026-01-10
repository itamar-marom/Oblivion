import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CreateAgentDto, UpdateAgentDto, CreateRegistrationTokenDto, RejectAgentDto } from './dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService, AgentConnection } from '../gateway/redis.service';
import { SlackService } from '../integrations/slack/slack.service';

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
  pendingApprovals: number;
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
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  // Connection status from Redis
  isConnected: boolean;
  connectionStatus: AgentConnection['status'] | 'offline';
  connectedAt?: string;
}

// Agents seen within this threshold are considered "online"
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

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
    private slackService: SlackService,
  ) {}

  /**
   * Get dashboard statistics for a tenant.
   */
  async getStats(tenantId: string): Promise<DashboardStats> {
    // Calculate threshold for "recently seen"
    const recentThreshold = new Date(Date.now() - ONLINE_THRESHOLD_MS);

    // Run queries in parallel
    const [
      connectedAgentIds,
      recentlySeenCount,
      totalAgents,
      activeTasks,
      pendingTasks,
      totalGroups,
      totalProjects,
      pendingApprovals,
    ] = await Promise.all([
      this.redisService.getConnectedAgentsForTenant(tenantId),
      // Count agents seen via REST API recently
      this.prisma.agent.count({
        where: {
          tenantId,
          isActive: true,
          lastSeenAt: { gte: recentThreshold },
        },
      }),
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
      this.prisma.agent.count({
        where: { tenantId, approvalStatus: 'PENDING' },
      }),
    ]);

    // Connected = WebSocket connected OR recently seen via API
    // Use max to avoid double-counting (some might be in both)
    const connectedAgents = Math.max(connectedAgentIds.length, recentlySeenCount);

    return {
      connectedAgents,
      totalAgents,
      activeTasks,
      pendingTasks,
      totalGroups,
      totalProjects,
      pendingApprovals,
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
      const hasWebSocket = connectedSet.has(agent.id);

      // Check if agent was seen recently via REST API
      const recentlySeenViaApi = !!(agent.lastSeenAt &&
        (Date.now() - agent.lastSeenAt.getTime()) < ONLINE_THRESHOLD_MS);

      // Agent is connected if they have WebSocket OR were recently seen via API
      const isConnected = hasWebSocket || recentlySeenViaApi;

      // Determine connection status
      let connectionStatus: AgentConnection['status'] | 'offline' = 'offline';
      if (conn?.status) {
        connectionStatus = conn.status;
      } else if (recentlySeenViaApi) {
        connectionStatus = 'connected'; // REST API activity counts as connected
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
        approvalStatus: agent.approvalStatus,
        isConnected,
        connectionStatus,
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

    // Check if agent was seen recently via REST API
    const recentlySeenViaApi = !!(agent.lastSeenAt &&
      (Date.now() - agent.lastSeenAt.getTime()) < ONLINE_THRESHOLD_MS);

    // Agent is connected if they have WebSocket OR were recently seen via API
    const isConnected = !!conn || recentlySeenViaApi;

    // Determine connection status
    let connectionStatus: AgentConnection['status'] | 'offline' = 'offline';
    if (conn?.status) {
      connectionStatus = conn.status;
    } else if (recentlySeenViaApi) {
      connectionStatus = 'connected';
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
      approvalStatus: agent.approvalStatus,
      isConnected,
      connectionStatus,
      connectedAt: conn?.connectedAt,
    };
  }

  /**
   * Create a new agent.
   */
  async createAgent(tenantId: string, dto: CreateAgentDto): Promise<AgentWithStatus> {
    // Check if clientId already exists for this tenant
    const existing = await this.prisma.agent.findFirst({
      where: { tenantId, clientId: dto.clientId },
    });

    if (existing) {
      throw new ConflictException(`Agent with clientId "${dto.clientId}" already exists`);
    }

    // Hash the client secret
    const hashedSecret = await bcrypt.hash(dto.clientSecret, 10);

    // Create the agent
    const agent = await this.prisma.agent.create({
      data: {
        tenantId,
        name: dto.name,
        clientId: dto.clientId,
        clientSecret: hashedSecret,
        description: dto.description || null,
        capabilities: dto.capabilities || [],
        isActive: true,
      },
    });

    this.logger.log(`Agent "${agent.name}" (${agent.clientId}) created via Observer`);

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
      approvalStatus: agent.approvalStatus,
      isConnected: false,
      connectionStatus: 'offline',
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
      approvalStatus: agent.approvalStatus,
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

  // =========================================================================
  // REGISTRATION TOKEN MANAGEMENT
  // =========================================================================

  /**
   * Generate a unique registration token with "reg_" prefix.
   */
  private generateToken(): string {
    return `reg_${crypto.randomBytes(12).toString('hex')}`;
  }

  /**
   * Create a registration token for a group.
   */
  async createRegistrationToken(
    tenantId: string,
    creatorId: string,
    dto: CreateRegistrationTokenDto,
  ) {
    // Verify group exists and belongs to tenant
    const group = await this.prisma.group.findFirst({
      where: { id: dto.groupId, tenantId, isActive: true },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Calculate expiration if provided
    const expiresAt = dto.expiresInHours
      ? new Date(Date.now() + dto.expiresInHours * 60 * 60 * 1000)
      : null;

    // Generate unique token
    const token = this.generateToken();

    // Create the registration token
    const registrationToken = await this.prisma.registrationToken.create({
      data: {
        groupId: dto.groupId,
        tenantId,
        token,
        name: dto.name || null,
        expiresAt,
        maxUses: dto.maxUses || null,
        createdById: creatorId,
      },
      include: {
        group: { select: { id: true, name: true } },
      },
    });

    this.logger.log(`Registration token created for group "${group.name}" by agent ${creatorId}`);

    return {
      id: registrationToken.id,
      token: registrationToken.token,
      groupId: registrationToken.groupId,
      groupName: registrationToken.group.name,
      name: registrationToken.name,
      expiresAt: registrationToken.expiresAt,
      maxUses: registrationToken.maxUses,
      usedCount: registrationToken.usedCount,
      isActive: registrationToken.isActive,
      createdAt: registrationToken.createdAt,
    };
  }

  /**
   * List registration tokens for a tenant.
   * Optionally filter by groupId.
   */
  async listRegistrationTokens(tenantId: string, groupId?: string) {
    const tokens = await this.prisma.registrationToken.findMany({
      where: {
        tenantId,
        ...(groupId && { groupId }),
      },
      include: {
        group: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tokens.map((t) => ({
      id: t.id,
      token: t.token,
      groupId: t.groupId,
      groupName: t.group.name,
      name: t.name,
      expiresAt: t.expiresAt,
      maxUses: t.maxUses,
      usedCount: t.usedCount,
      isActive: t.isActive,
      createdAt: t.createdAt,
      createdBy: t.createdBy,
    }));
  }

  /**
   * Revoke (deactivate) a registration token.
   */
  async revokeRegistrationToken(tenantId: string, tokenId: string) {
    const token = await this.prisma.registrationToken.findFirst({
      where: { id: tokenId, tenantId },
    });

    if (!token) {
      throw new NotFoundException('Registration token not found');
    }

    if (!token.isActive) {
      throw new BadRequestException('Token is already revoked');
    }

    await this.prisma.registrationToken.update({
      where: { id: tokenId },
      data: { isActive: false },
    });

    this.logger.log(`Registration token ${tokenId} revoked`);

    return { success: true };
  }

  // =========================================================================
  // AGENT APPROVAL WORKFLOW
  // =========================================================================

  /**
   * Get agents pending approval for a tenant.
   */
  async getPendingAgents(tenantId: string) {
    const agents = await this.prisma.agent.findMany({
      where: { tenantId, approvalStatus: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    // Get pending group info for each agent
    const agentsWithGroups = await Promise.all(
      agents.map(async (agent) => {
        let pendingGroup: { id: string; name: string } | null = null;
        if (agent.pendingGroupId) {
          pendingGroup = await this.prisma.group.findUnique({
            where: { id: agent.pendingGroupId },
            select: { id: true, name: true },
          });
        }

        return {
          id: agent.id,
          name: agent.name,
          clientId: agent.clientId,
          description: agent.description,
          email: agent.email,
          capabilities: agent.capabilities,
          approvalStatus: agent.approvalStatus,
          pendingGroup,
          createdAt: agent.createdAt,
        };
      }),
    );

    return agentsWithGroups;
  }

  /**
   * Get count of pending approvals for badge display.
   */
  async getPendingCount(tenantId: string) {
    const count = await this.prisma.agent.count({
      where: { tenantId, approvalStatus: 'PENDING' },
    });
    return { count };
  }

  /**
   * Approve an agent registration.
   * - Sets approval status to APPROVED
   * - Creates group membership for pendingGroupId
   * - Clears pendingGroupId
   * - Invites agent to group's Slack channel
   */
  async approveAgent(tenantId: string, agentId: string, approverId: string) {
    // Find the pending agent
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    if (agent.approvalStatus !== 'PENDING') {
      throw new BadRequestException(`Agent is not pending approval (status: ${agent.approvalStatus})`);
    }

    // Get the pending group
    const group = agent.pendingGroupId
      ? await this.prisma.group.findUnique({
          where: { id: agent.pendingGroupId },
        })
      : null;

    // Update agent and create group membership in transaction
    await this.prisma.$transaction(async (tx) => {
      // Update agent approval status
      await tx.agent.update({
        where: { id: agentId },
        data: {
          approvalStatus: 'APPROVED',
          approvedAt: new Date(),
          approvedById: approverId,
          pendingGroupId: null, // Clear pending group
        },
      });

      // Create group membership if there's a pending group
      if (agent.pendingGroupId) {
        await tx.agentGroupMembership.create({
          data: {
            agentId,
            groupId: agent.pendingGroupId,
            role: 'member',
          },
        });
      }
    });

    // Invite agent to Slack channel (best effort, outside transaction)
    if (group?.slackChannelId && agent.slackUserId) {
      try {
        await this.slackService.inviteUserToChannel(group.slackChannelId, agent.slackUserId);
        this.logger.log(`Invited agent ${agent.name} to Slack channel ${group.slackChannelName}`);
      } catch (error) {
        this.logger.warn(`Failed to invite agent to Slack: ${error.message}`);
      }
    }

    this.logger.log(
      `Agent "${agent.name}" approved by ${approverId}${group ? ` and added to group "${group.name}"` : ''}`,
    );

    // Return updated agent
    return this.getAgent(tenantId, agentId);
  }

  /**
   * Reject an agent registration.
   */
  async rejectAgent(tenantId: string, agentId: string, rejecterId: string, dto?: RejectAgentDto) {
    // Find the pending agent
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    if (agent.approvalStatus !== 'PENDING') {
      throw new BadRequestException(`Agent is not pending approval (status: ${agent.approvalStatus})`);
    }

    // Update agent
    await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        approvalStatus: 'REJECTED',
        rejectedAt: new Date(),
        rejectedById: rejecterId,
        rejectionReason: dto?.reason || null,
        pendingGroupId: null, // Clear pending group
        isActive: false, // Deactivate rejected agent
      },
    });

    this.logger.log(
      `Agent "${agent.name}" rejected by ${rejecterId}${dto?.reason ? `: ${dto.reason}` : ''}`,
    );

    // Return updated agent
    return this.getAgent(tenantId, agentId);
  }
}
