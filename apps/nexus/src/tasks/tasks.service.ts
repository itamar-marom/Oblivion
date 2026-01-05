import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentGateway } from '../gateway/agent.gateway';
import { SlackService } from '../integrations/slack/slack.service';
import {
  EventType,
  createEvent,
  TaskAvailablePayload,
  TaskClaimedPayload,
  ClaimTaskResultPayload,
} from '../gateway/dto/events.dto';

/**
 * Tasks Service.
 *
 * Handles task lifecycle including:
 * - Task creation (from ClickUp webhooks)
 * - Task claiming by agents
 * - Broadcasting availability to group members
 * - Notifying when tasks are claimed
 */
@Injectable()
export class TasksService implements OnModuleInit {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prisma: PrismaService,
    private gateway: AgentGateway,
    private slackService: SlackService,
  ) {}

  /**
   * Register the claim task handler with the Gateway.
   */
  onModuleInit() {
    this.gateway.setClaimTaskHandler(this.claimTask.bind(this));
    console.log('TasksService: Registered claim handler with Gateway');
  }

  /**
   * Create a new task and broadcast to group members.
   * Called when a ClickUp task with @tag is created.
   */
  async createTask(data: {
    projectId: string;
    clickupTaskId: string;
    title: string;
    description?: string;
    priority?: number;
  }) {
    // Get project with group info
    const project = await this.prisma.project.findUnique({
      where: { id: data.projectId },
      include: {
        group: {
          include: {
            members: {
              where: { agent: { isActive: true } },
              include: {
                agent: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!project || !project.isActive) {
      throw new NotFoundException('Project not found');
    }

    // Check if task already exists
    const existing = await this.prisma.task.findUnique({
      where: { clickupTaskId: data.clickupTaskId },
    });

    if (existing) {
      throw new ConflictException('Task already exists');
    }

    // Create the task
    const task = await this.prisma.task.create({
      data: {
        projectId: data.projectId,
        clickupTaskId: data.clickupTaskId,
        title: data.title,
        priority: data.priority ?? 3,
        status: 'TODO',
      },
    });

    // Broadcast TASK_AVAILABLE to all group members
    const agentIds = project.group.members.map((m) => m.agent.id);

    if (agentIds.length > 0) {
      const payload: TaskAvailablePayload = {
        taskId: task.id,
        projectId: project.id,
        projectName: project.name,
        groupId: project.group.id,
        groupName: project.group.name,
        clickupTaskId: task.clickupTaskId,
        slackChannelId: project.slackChannelId ?? undefined,
        title: task.title ?? '',
        description: data.description,
        priority: task.priority,
        createdAt: task.createdAt.toISOString(),
      };

      await this.gateway.emitToAgents(
        agentIds,
        createEvent(EventType.TASK_AVAILABLE, payload),
      );

      console.log(
        `Task ${task.id} broadcast to ${agentIds.length} agents in group "${project.group.name}"`,
      );
    }

    return {
      task,
      notifiedAgents: agentIds.length,
    };
  }

  /**
   * Claim a task for an agent.
   * Uses optimistic locking to handle race conditions.
   */
  async claimTask(
    agentId: string,
    taskId: string,
  ): Promise<ClaimTaskResultPayload> {
    // Get task with project and group info
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            group: {
              include: {
                members: {
                  where: { agent: { isActive: true } },
                  include: {
                    agent: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!task) {
      return {
        taskId,
        success: false,
        error: 'Task not found',
      };
    }

    // Check if task is already claimed
    if (task.claimedByAgentId) {
      return {
        taskId,
        success: false,
        error: 'Task already claimed',
      };
    }

    // Check if agent is in the group
    const isMember = task.project.group.members.some(
      (m) => m.agent.id === agentId,
    );

    if (!isMember) {
      return {
        taskId,
        success: false,
        error: 'Agent not in project group',
      };
    }

    // Attempt to claim with optimistic locking
    // Only update if status is still TODO (no one else claimed it)
    const claimedAt = new Date();

    try {
      const updated = await this.prisma.task.updateMany({
        where: {
          id: taskId,
          claimedByAgentId: null, // Optimistic lock
          status: 'TODO',
        },
        data: {
          claimedByAgentId: agentId,
          claimedAt,
          status: 'CLAIMED',
        },
      });

      if (updated.count === 0) {
        // Another agent claimed it first
        return {
          taskId,
          success: false,
          error: 'Task was claimed by another agent',
        };
      }
    } catch {
      return {
        taskId,
        success: false,
        error: 'Failed to claim task',
      };
    }

    // Get agent name for notification
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { name: true },
    });

    // Notify other agents in the group that task was claimed
    const otherAgentIds = task.project.group.members
      .filter((m) => m.agent.id !== agentId)
      .map((m) => m.agent.id);

    if (otherAgentIds.length > 0) {
      const claimedPayload: TaskClaimedPayload = {
        taskId,
        projectId: task.projectId,
        claimedByAgentId: agentId,
        claimedByAgentName: agent?.name ?? 'Unknown',
        claimedAt: claimedAt.toISOString(),
      };

      await this.gateway.emitToAgents(
        otherAgentIds,
        createEvent(EventType.TASK_CLAIMED, claimedPayload),
      );
    }

    // Post to Slack thread if task has Slack info
    if (task.slackChannelId && task.slackThreadTs) {
      const agentName = agent?.name ?? 'An agent';
      await this.slackService.postThreadReply(
        task.slackChannelId,
        task.slackThreadTs,
        `🤖 *${agentName}* claimed this task and is starting work.`,
      );
      this.logger.log(`Slack notified: ${agentName} claimed task ${taskId}`);
    }

    this.logger.log(
      `Task ${taskId} claimed by agent ${agentId} (${agent?.name})`,
    );

    return {
      taskId,
      success: true,
      claimedAt: claimedAt.toISOString(),
    };
  }

  /**
   * Get available tasks for an agent.
   * Returns unclaimed tasks from all groups the agent belongs to.
   */
  async getAvailableTasks(agentId: string) {
    // Get all groups the agent belongs to
    const memberships = await this.prisma.agentGroupMembership.findMany({
      where: { agentId },
      select: { groupId: true },
    });

    const groupIds = memberships.map((m) => m.groupId);

    if (groupIds.length === 0) {
      return [];
    }

    // Get unclaimed tasks from those groups
    const tasks = await this.prisma.task.findMany({
      where: {
        status: 'TODO',
        claimedByAgentId: null,
        project: {
          groupId: { in: groupIds },
          isActive: true,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
            group: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    return tasks.map((task) => ({
      taskId: task.id,
      clickupTaskId: task.clickupTaskId,
      title: task.title,
      priority: task.priority,
      projectId: task.project.id,
      projectName: task.project.name,
      groupId: task.project.group.id,
      groupName: task.project.group.name,
      createdAt: task.createdAt,
    }));
  }

  /**
   * Get tasks claimed by an agent.
   */
  async getClaimedTasks(agentId: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        claimedByAgentId: agentId,
        status: { not: 'DONE' },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slackChannelId: true,
            slackChannelName: true,
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { claimedAt: 'desc' }],
    });

    return tasks;
  }

  /**
   * Update task status.
   */
  async updateTaskStatus(
    agentId: string,
    taskId: string,
    status: 'IN_PROGRESS' | 'BLOCKED_ON_HUMAN' | 'DONE',
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.claimedByAgentId !== agentId) {
      throw new ForbiddenException('Task not claimed by this agent');
    }

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status },
    });

    return updated;
  }

  /**
   * Update Slack thread info for a task.
   */
  async updateSlackThread(
    taskId: string,
    slackChannelId: string,
    slackThreadTs: string,
  ) {
    return this.prisma.task.update({
      where: { id: taskId },
      data: { slackChannelId, slackThreadTs },
    });
  }

  /**
   * Find task by ClickUp task ID.
   */
  async findByClickupId(clickupTaskId: string) {
    return this.prisma.task.findUnique({
      where: { clickupTaskId },
      include: {
        project: {
          include: {
            group: true,
          },
        },
        claimedByAgent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Find task by internal ID.
   */
  async findById(taskId: string) {
    return this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            group: true,
          },
        },
        claimedByAgent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Post a message to a task's Slack thread.
   * Only the agent who claimed the task can post to its thread.
   * If the task doesn't have a Slack thread yet, creates one in the project's channel.
   */
  async postToSlackThread(
    agentId: string,
    taskId: string,
    message: string,
    broadcast?: boolean,
  ) {
    // Find task by ID (try internal ID first, then ClickUp ID)
    let task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        claimedByAgent: { select: { id: true, name: true } },
        project: { select: { slackChannelId: true, name: true } },
      },
    });

    if (!task) {
      task = await this.prisma.task.findUnique({
        where: { clickupTaskId: taskId },
        include: {
          claimedByAgent: { select: { id: true, name: true } },
          project: { select: { slackChannelId: true, name: true } },
        },
      });
    }

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Verify the agent has claimed this task
    if (task.claimedByAgentId !== agentId) {
      throw new ForbiddenException('Only the agent who claimed this task can post to its Slack thread');
    }

    // Determine channel to use (task's channel or project's channel)
    const channelId = task.slackChannelId || task.project?.slackChannelId;

    if (!channelId) {
      throw new NotFoundException('No Slack channel configured for this task or project');
    }

    let threadTs = task.slackThreadTs;

    // If no thread exists, create one with a root message
    if (!threadTs) {
      this.logger.log(`Creating new Slack thread for task ${taskId}`);

      const rootMessage = `📋 *Task:* ${task.title || `Task ${task.clickupTaskId}`}\n🤖 Agent *${task.claimedByAgent?.name}* is working on this task.`;
      const rootResult = await this.slackService.postMessage(channelId, rootMessage);

      if (!rootResult) {
        throw new Error('Failed to create Slack thread');
      }

      threadTs = rootResult.messageTs;

      // Save thread info to the task
      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          slackChannelId: channelId,
          slackThreadTs: threadTs,
        },
      });

      this.logger.log(`Created Slack thread for task ${taskId}: ${threadTs}`);
    }

    // Post to Slack thread
    const result = await this.slackService.postThreadReply(
      channelId,
      threadTs,
      message,
      { broadcast },
    );

    if (!result) {
      throw new Error('Failed to post to Slack');
    }

    this.logger.log(`Agent ${agentId} posted to Slack thread for task ${taskId}`);

    return {
      ok: true,
      channelId: result.channelId,
      messageTs: result.messageTs,
    };
  }

  /**
   * Sync task status from ClickUp webhook.
   *
   * Maps ClickUp status to internal status and updates the task.
   * Returns task info for emitting events, or null if task not found.
   *
   * @param clickupTaskId - ClickUp task ID
   * @param clickupStatus - ClickUp status string (e.g., "in progress", "done")
   * @returns Updated task info with project and group, or null
   */
  async syncStatusFromClickUp(
    clickupTaskId: string,
    clickupStatus: string,
  ): Promise<{
    task: {
      id: string;
      title: string;
      status: string;
      previousStatus: string;
      slackChannelId: string | null;
      slackThreadTs: string | null;
    };
    project: { id: string; name: string };
    group: { id: string; name: string };
    agents: { id: string; name: string }[];
  } | null> {
    // Find task by ClickUp ID
    const task = await this.prisma.task.findUnique({
      where: { clickupTaskId },
      include: {
        project: {
          include: {
            group: {
              include: {
                members: {
                  where: { agent: { isActive: true } },
                  include: {
                    agent: {
                      select: { id: true, name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!task) {
      return null;
    }

    // Map ClickUp status to internal status
    const statusUpper = clickupStatus.toUpperCase();
    let newStatus: 'TODO' | 'CLAIMED' | 'IN_PROGRESS' | 'BLOCKED_ON_HUMAN' | 'DONE' = task.status as any;

    if (statusUpper.includes('DONE') || statusUpper.includes('COMPLETE') || statusUpper.includes('CLOSED')) {
      newStatus = 'DONE';
    } else if (statusUpper.includes('PROGRESS') || statusUpper.includes('REVIEW') || statusUpper.includes('WORKING')) {
      newStatus = 'IN_PROGRESS';
    } else if (statusUpper.includes('BLOCK') || statusUpper.includes('WAITING') || statusUpper.includes('HOLD')) {
      newStatus = 'BLOCKED_ON_HUMAN';
    } else if (statusUpper.includes('TODO') || statusUpper.includes('OPEN') || statusUpper.includes('NEW')) {
      // Only reset to TODO if not already claimed
      if (task.status === 'TODO') {
        newStatus = 'TODO';
      }
    }

    const previousStatus = task.status;

    // Only update if status actually changed
    if (newStatus !== previousStatus) {
      await this.prisma.task.update({
        where: { id: task.id },
        data: { status: newStatus },
      });

      this.logger.log(`Task ${task.id} status synced: ${previousStatus} → ${newStatus}`);
    }

    return {
      task: {
        id: task.id,
        title: task.title || `Task ${task.clickupTaskId}`,
        status: newStatus,
        previousStatus,
        slackChannelId: task.slackChannelId,
        slackThreadTs: task.slackThreadTs,
      },
      project: {
        id: task.project.id,
        name: task.project.name,
      },
      group: {
        id: task.project.group.id,
        name: task.project.group.name,
      },
      agents: task.project.group.members.map((m) => m.agent),
    };
  }
}
