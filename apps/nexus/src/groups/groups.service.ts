import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SlackService } from '../integrations/slack/slack.service';
import { CreateGroupDto, UpdateGroupDto, AddMemberDto } from './dto';

/**
 * Groups Service.
 *
 * Manages Agent Teams (Groups) with:
 * - CRUD operations for groups
 * - Member management (add/remove agents)
 * - Slack channel auto-creation/archival
 */
@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    private prisma: PrismaService,
    private slackService: SlackService,
  ) {}

  /**
   * Create a new group with auto-created Slack channel.
   */
  async create(tenantId: string, dto: CreateGroupDto) {
    // Check if slug already exists for this tenant
    const existing = await this.prisma.group.findUnique({
      where: {
        tenantId_slug: {
          tenantId,
          slug: dto.slug,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Group with slug "${dto.slug}" already exists`);
    }

    // Create Slack channel
    const channelName = `oblivion-${dto.slug}`;
    let slackChannelId: string | null = null;

    const slackResult = await this.slackService.createChannel(channelName);
    if (slackResult) {
      slackChannelId = slackResult.channelId;
      this.logger.log(`Slack channel created for group: ${slackResult.channelName}`);

      // Post welcome message
      await this.slackService.postWelcomeMessage(slackChannelId, 'group', dto.name);
    } else {
      this.logger.warn(`Failed to create Slack channel for group "${dto.name}"`);
    }

    // Create the group
    const group = await this.prisma.group.create({
      data: {
        tenantId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        slackChannelId,
        slackChannelName: `#${channelName}`,
      },
      include: {
        members: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                isActive: true,
              },
            },
          },
        },
        projects: true,
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
    });

    return this.formatGroupResponse(group);
  }

  /**
   * Get all groups for a tenant.
   */
  async findAll(tenantId: string, includeInactive = false) {
    const groups = await this.prisma.group.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      slackChannelName: group.slackChannelName,
      isActive: group.isActive,
      memberCount: group._count.members,
      projectCount: group._count.projects,
      createdAt: group.createdAt,
    }));
  }

  /**
   * Get a single group by ID with full details.
   */
  async findOne(tenantId: string, groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: {
        id: groupId,
        tenantId,
      },
      include: {
        members: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                description: true,
                avatarUrl: true,
                isActive: true,
                lastSeenAt: true,
                capabilities: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        projects: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            oblivionTag: true,
            slackChannelName: true,
            isActive: true,
          },
          orderBy: { name: 'asc' },
        },
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException(`Group not found`);
    }

    return this.formatGroupResponse(group);
  }

  /**
   * Update a group.
   */
  async update(tenantId: string, groupId: string, dto: UpdateGroupDto) {
    // Verify group exists and belongs to tenant
    const existing = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Group not found`);
    }

    const group = await this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        members: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                isActive: true,
              },
            },
          },
        },
        projects: {
          where: { isActive: true },
        },
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
    });

    return this.formatGroupResponse(group);
  }

  /**
   * Archive a group (soft delete) and archive its Slack channel.
   */
  async archive(tenantId: string, groupId: string) {
    const existing = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Group not found`);
    }

    // Archive the group
    await this.prisma.group.update({
      where: { id: groupId },
      data: { isActive: false },
    });

    // Archive Slack channel
    if (existing.slackChannelId) {
      const archived = await this.slackService.archiveChannel(existing.slackChannelId);
      if (archived) {
        this.logger.log(`Slack channel archived for group "${existing.name}"`);
      }
    }

    return { success: true, message: 'Group archived' };
  }

  /**
   * Add an agent to a group.
   * Also invites the agent to the group's Slack channel.
   * If agent has email but no slackUserId, attempts auto-lookup.
   */
  async addMember(tenantId: string, groupId: string, dto: AddMemberDto) {
    // Verify group exists
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId, isActive: true },
    });

    if (!group) {
      throw new NotFoundException(`Group not found`);
    }

    // Verify agent exists and belongs to same tenant
    const agent = await this.prisma.agent.findFirst({
      where: { id: dto.agentId, tenantId, isActive: true },
      select: { id: true, name: true, email: true, avatarUrl: true, slackUserId: true },
    });

    if (!agent) {
      throw new NotFoundException(`Agent not found`);
    }

    // Check if already a member
    const existing = await this.prisma.agentGroupMembership.findUnique({
      where: {
        agentId_groupId: {
          agentId: dto.agentId,
          groupId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Agent is already a member of this group`);
    }

    // Auto-lookup Slack user ID by email if not already set
    let slackUserId = agent.slackUserId;
    if (!slackUserId && agent.email && group.slackChannelId) {
      const foundUserId = await this.slackService.findUserByEmail(agent.email);
      if (foundUserId) {
        slackUserId = foundUserId;
        // Persist the discovered Slack user ID
        await this.prisma.agent.update({
          where: { id: agent.id },
          data: { slackUserId: foundUserId },
        });
        this.logger.log(`Auto-discovered Slack user ID for "${agent.name}" via email`);
      }
    }

    // Add membership
    const membership = await this.prisma.agentGroupMembership.create({
      data: {
        agentId: dto.agentId,
        groupId,
        role: dto.role || 'member',
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    // Invite agent to Slack channel if we have the Slack user ID
    if (group.slackChannelId && slackUserId) {
      const invited = await this.slackService.inviteUserToChannel(
        group.slackChannelId,
        slackUserId,
      );
      if (invited) {
        this.logger.log(`Agent "${agent.name}" invited to Slack channel ${group.slackChannelName}`);
      }
    }

    return {
      id: membership.id,
      agentId: membership.agentId,
      agentName: membership.agent.name,
      role: membership.role,
      joinedAt: membership.joinedAt,
    };
  }

  /**
   * Remove an agent from a group.
   * Also removes the agent from the group's Slack channel if applicable.
   */
  async removeMember(tenantId: string, groupId: string, agentId: string) {
    // Verify group exists and belongs to tenant
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId },
    });

    if (!group) {
      throw new NotFoundException(`Group not found`);
    }

    // Find membership with agent's Slack info
    const membership = await this.prisma.agentGroupMembership.findUnique({
      where: {
        agentId_groupId: {
          agentId,
          groupId,
        },
      },
      include: {
        agent: {
          select: { name: true, slackUserId: true },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException(`Agent is not a member of this group`);
    }

    // Remove membership
    await this.prisma.agentGroupMembership.delete({
      where: { id: membership.id },
    });

    // Remove agent from Slack channel if both have Slack IDs
    if (group.slackChannelId && membership.agent.slackUserId) {
      const removed = await this.slackService.removeUserFromChannel(
        group.slackChannelId,
        membership.agent.slackUserId,
      );
      if (removed) {
        this.logger.log(`Agent "${membership.agent.name}" removed from Slack channel ${group.slackChannelName}`);
      }
    }

    return { success: true, message: 'Member removed from group' };
  }

  /**
   * Get all members of a group.
   */
  async getMembers(tenantId: string, groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, tenantId },
    });

    if (!group) {
      throw new NotFoundException(`Group not found`);
    }

    const memberships = await this.prisma.agentGroupMembership.findMany({
      where: { groupId },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            description: true,
            avatarUrl: true,
            isActive: true,
            lastSeenAt: true,
            capabilities: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      agent: m.agent,
    }));
  }

  /**
   * Format group response with consistent structure.
   */
  private formatGroupResponse(group: any) {
    return {
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      slackChannelId: group.slackChannelId,
      slackChannelName: group.slackChannelName,
      isActive: group.isActive,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      memberCount: group._count?.members ?? group.members?.length ?? 0,
      projectCount: group._count?.projects ?? group.projects?.length ?? 0,
      members: group.members?.map((m: any) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.joinedAt,
        agent: m.agent,
      })),
      projects: group.projects,
    };
  }
}
