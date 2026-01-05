import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SlackService } from '../integrations/slack/slack.service';
import { CreateProjectDto, UpdateProjectDto } from './dto';

/**
 * Projects Service.
 *
 * Manages Work Scopes (Projects) with:
 * - CRUD operations for projects
 * - @tag routing for ClickUp integration
 * - Slack channel auto-creation/archival
 *
 * Projects belong to exactly one Group and can have multiple Tasks.
 */
@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private prisma: PrismaService,
    private slackService: SlackService,
  ) {}

  /**
   * Create a new project under a group with auto-created Slack channel.
   */
  async create(tenantId: string, dto: CreateProjectDto) {
    // Verify group exists and belongs to tenant
    const group = await this.prisma.group.findFirst({
      where: {
        id: dto.groupId,
        tenantId,
        isActive: true,
      },
    });

    if (!group) {
      throw new NotFoundException(`Group not found`);
    }

    // Check if slug already exists for this group
    const existingSlug = await this.prisma.project.findUnique({
      where: {
        groupId_slug: {
          groupId: dto.groupId,
          slug: dto.slug,
        },
      },
    });

    if (existingSlug) {
      throw new ConflictException(`Project with slug "${dto.slug}" already exists in this group`);
    }

    // Check if oblivionTag is unique (globally)
    if (dto.oblivionTag) {
      const existingTag = await this.prisma.project.findUnique({
        where: { oblivionTag: dto.oblivionTag },
      });

      if (existingTag) {
        throw new ConflictException(`Oblivion tag "@${dto.oblivionTag}" is already in use`);
      }
    }

    // Create Slack channel for the project (naming: oblivion-{group-slug}_{project-slug})
    const channelName = `oblivion-${group.slug}_${dto.slug}`;
    let slackChannelId: string | null = null;

    const slackResult = await this.slackService.createChannel(channelName);
    if (slackResult) {
      slackChannelId = slackResult.channelId;
      this.logger.log(`Slack channel created for project: ${slackResult.channelName}`);

      // Post welcome message
      await this.slackService.postWelcomeMessage(slackChannelId, 'project', dto.name);
    } else {
      this.logger.warn(`Failed to create Slack channel for project "${dto.name}"`);
    }

    // Create the project
    const project = await this.prisma.project.create({
      data: {
        groupId: dto.groupId,
        tenantId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        oblivionTag: dto.oblivionTag,
        slackChannelId,
        slackChannelName: `#${channelName}`,
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    return this.formatProjectResponse(project);
  }

  /**
   * Get all projects for a tenant.
   * Can be filtered by group.
   */
  async findAll(tenantId: string, groupId?: string, includeInactive = false) {
    const projects = await this.prisma.project.findMany({
      where: {
        tenantId,
        ...(groupId && { groupId }),
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
      orderBy: [{ group: { name: 'asc' } }, { name: 'asc' }],
    });

    return projects.map((project) => this.formatProjectResponse(project));
  }

  /**
   * Get a single project by ID with full details.
   */
  async findOne(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId,
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            slug: true,
            slackChannelName: true,
          },
        },
        tasks: {
          where: {
            status: { not: 'DONE' },
          },
          select: {
            id: true,
            clickupTaskId: true,
            title: true,
            status: true,
            priority: true,
            claimedByAgentId: true,
            claimedAt: true,
            createdAt: true,
          },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
          take: 50, // Limit to recent tasks
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project not found`);
    }

    return this.formatProjectResponse(project);
  }

  /**
   * Find a project by its oblivion tag.
   * Used for routing ClickUp tasks.
   */
  async findByTag(tag: string) {
    const project = await this.prisma.project.findUnique({
      where: { oblivionTag: tag },
      include: {
        group: {
          include: {
            members: {
              where: {
                agent: { isActive: true },
              },
              include: {
                agent: {
                  select: {
                    id: true,
                    name: true,
                    capabilities: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!project || !project.isActive) {
      return null;
    }

    return {
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        oblivionTag: project.oblivionTag,
        slackChannelId: project.slackChannelId,
        slackChannelName: project.slackChannelName,
      },
      group: {
        id: project.group.id,
        name: project.group.name,
        slug: project.group.slug,
      },
      agents: project.group.members.map((m) => m.agent),
    };
  }

  /**
   * Update a project.
   */
  async update(tenantId: string, projectId: string, dto: UpdateProjectDto) {
    // Verify project exists and belongs to tenant
    const existing = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Project not found`);
    }

    // Check if new oblivionTag is unique
    if (dto.oblivionTag && dto.oblivionTag !== existing.oblivionTag) {
      const existingTag = await this.prisma.project.findUnique({
        where: { oblivionTag: dto.oblivionTag },
      });

      if (existingTag) {
        throw new ConflictException(`Oblivion tag "@${dto.oblivionTag}" is already in use`);
      }
    }

    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.oblivionTag !== undefined && { oblivionTag: dto.oblivionTag }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    return this.formatProjectResponse(project);
  }

  /**
   * Archive a project (soft delete) and archive its Slack channel.
   */
  async archive(tenantId: string, projectId: string) {
    const existing = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
    });

    if (!existing) {
      throw new NotFoundException(`Project not found`);
    }

    // Archive the project
    await this.prisma.project.update({
      where: { id: projectId },
      data: { isActive: false },
    });

    // Archive Slack channel
    if (existing.slackChannelId) {
      const archived = await this.slackService.archiveChannel(existing.slackChannelId);
      if (archived) {
        this.logger.log(`Slack channel archived for project "${existing.name}"`);
      }
    }

    return { success: true, message: 'Project archived' };
  }

  /**
   * Get task statistics for a project.
   */
  async getTaskStats(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
    });

    if (!project) {
      throw new NotFoundException(`Project not found`);
    }

    const stats = await this.prisma.task.groupBy({
      by: ['status'],
      where: { projectId },
      _count: { id: true },
    });

    const statusCounts = stats.reduce(
      (acc, s) => {
        acc[s.status] = s._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      projectId,
      total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      todo: statusCounts['TODO'] || 0,
      claimed: statusCounts['CLAIMED'] || 0,
      inProgress: statusCounts['IN_PROGRESS'] || 0,
      blockedOnHuman: statusCounts['BLOCKED_ON_HUMAN'] || 0,
      done: statusCounts['DONE'] || 0,
    };
  }

  /**
   * Format project response with consistent structure.
   */
  private formatProjectResponse(project: any) {
    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      oblivionTag: project.oblivionTag,
      slackChannelId: project.slackChannelId,
      slackChannelName: project.slackChannelName,
      isActive: project.isActive,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      taskCount: project._count?.tasks ?? 0,
      group: project.group,
      tasks: project.tasks,
    };
  }
}
