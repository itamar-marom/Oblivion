import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../queue/queue.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentGateway, createEvent, EventType } from '../../gateway';
import type {
  ContextUpdatePayload,
  SlackMessagePayload,
} from '../../gateway/dto/events.dto';
import { ClickUpService } from '../../integrations/clickup/clickup.service';
import { SlackService } from '../../integrations/slack/slack.service';
import { ProjectsService } from '../../projects/projects.service';
import { TasksService } from '../../tasks/tasks.service';
import { CLICKUP_JOB_TYPES } from '../dto/clickup-webhook.dto';
import type { ClickUpWebhookJob } from '../dto/clickup-webhook.dto';
import { SLACK_JOB_TYPES } from '../dto/slack-webhook.dto';
import type { SlackWebhookJob } from '../dto/slack-webhook.dto';

/**
 * WebhookProcessor handles all webhook jobs from the queue.
 *
 * This unified processor routes jobs to the appropriate handler
 * based on the job name prefix (clickup: or slack:).
 *
 * Job types:
 * - clickup:task-created: New task assigned to agent
 * - clickup:task-updated: Task status/properties changed
 * - clickup:task-comment: Human commented on task
 * - slack:message: New message in channel/thread
 * - slack:app-mention: Bot was @mentioned
 */
@Processor(QUEUE_NAMES.WEBHOOK_PROCESSING)
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    private prisma: PrismaService,
    private gateway: AgentGateway,
    private clickUpService: ClickUpService,
    private slackService: SlackService,
    private projectsService: ProjectsService,
    private tasksService: TasksService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing ${job.name} (id: ${job.id})`);

    try {
      // Route to appropriate handler based on job name prefix
      if (job.name.startsWith('clickup:')) {
        await this.handleClickUpJob(job);
      } else if (job.name.startsWith('slack:')) {
        await this.handleSlackJob(job);
      } else {
        this.logger.warn(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process ${job.name}: ${error}`);
      throw error; // Re-throw to trigger retry
    }
  }

  // ==================== ClickUp Handlers ====================

  private async handleClickUpJob(job: Job): Promise<void> {
    const data = job.data as ClickUpWebhookJob;

    switch (job.name) {
      case CLICKUP_JOB_TYPES.TASK_CREATED:
        await this.handleTaskCreated(data);
        break;
      case CLICKUP_JOB_TYPES.TASK_UPDATED:
        await this.handleTaskUpdated(data);
        break;
      case CLICKUP_JOB_TYPES.TASK_COMMENT:
        await this.handleTaskComment(data);
        break;
      default:
        this.logger.warn(`Unknown ClickUp job type: ${job.name}`);
    }
  }

  /**
   * Handle new task creation.
   *
   * Flow (@tag routing):
   * 1. Fetch full task details from ClickUp API
   * 2. Parse @tag from description (e.g., @auth-refactor)
   * 3. If @tag found, route via Project → Group → Agents (TASK_AVAILABLE)
   * 4. If no @tag, log and skip (tasks must use @tag routing)
   */
  private async handleTaskCreated(data: ClickUpWebhookJob): Promise<void> {
    this.logger.log(`Task created: ${data.taskId}`);

    // Fetch full task details from ClickUp API
    const task = await this.clickUpService.getTask(data.taskId);

    if (!task) {
      this.logger.warn(`Could not fetch task ${data.taskId} from ClickUp API`);
      return;
    }

    // Get description for @tag parsing
    const description = task.text_content || task.description || '';

    // Parse @tag from description for project routing
    const oblivionTag = this.clickUpService.parseOblivionTag(description);

    if (!oblivionTag) {
      this.logger.debug(`No @tag found in task ${data.taskId}, skipping`);
      return;
    }

    this.logger.log(`Found @tag: ${oblivionTag}`);

    // Look up project by tag
    const projectInfo = await this.projectsService.findByTag(oblivionTag);

    if (!projectInfo) {
      this.logger.warn(`No project found for @tag "${oblivionTag}"`);
      return;
    }

    this.logger.log(
      `Routing to project "${projectInfo.project.name}" (group: ${projectInfo.group.name})`,
    );

    // Create Slack thread in project's channel (if configured)
    let slackChannelId: string | undefined;
    let slackThreadTs: string | undefined;

    if (projectInfo.project.slackChannelId) {
      const taskSummary = this.clickUpService.extractTaskSummary(task);
      const slackResult = await this.slackService.postTaskMessage(
        projectInfo.project.slackChannelId,
        {
          taskId: data.taskId,
          ...taskSummary,
        },
      );

      if (slackResult) {
        slackChannelId = projectInfo.project.slackChannelId;
        slackThreadTs = slackResult.threadTs;
        this.logger.log(`Slack thread created: ${slackThreadTs}`);
      }
    }

    // Create task via TasksService (broadcasts TASK_AVAILABLE to group)
    const result = await this.tasksService.createTask({
      projectId: projectInfo.project.id,
      clickupTaskId: data.taskId,
      title: task.name,
      description: description,
      priority: this.clickUpService.mapPriority(task),
    });

    // Update task with Slack thread info if created
    if (slackChannelId && slackThreadTs) {
      await this.tasksService.updateSlackThread(
        result.task.id,
        slackChannelId,
        slackThreadTs,
      );
    }

    this.logger.log(
      `Task ${result.task.id} created via @tag routing, notified ${result.notifiedAgents} agents`,
    );
  }

  /**
   * Handle task updates (status changes, etc.).
   *
   * Parses history_items from the webhook payload to detect changes,
   * then syncs status to the Task model.
   */
  private async handleTaskUpdated(data: ClickUpWebhookJob): Promise<void> {
    this.logger.log(`Task updated: ${data.taskId}`);

    // Parse history_items to find what changed
    const historyItems = data.raw.history_items || [];
    const statusChange = historyItems.find(
      (item: { field?: string }) => item.field === 'status',
    );

    // Fetch updated task from ClickUp for current status
    const task = await this.clickUpService.getTask(data.taskId);

    if (!task) {
      this.logger.warn(`Could not fetch task ${data.taskId} from ClickUp API`);
      return;
    }

    const clickupStatus = task.status.status;

    // Log status change details if available
    if (statusChange) {
      const beforeStatus =
        (statusChange.before as { status?: string })?.status || 'unknown';
      const afterStatus =
        (statusChange.after as { status?: string })?.status || clickupStatus;
      this.logger.log(
        `Status change detected: "${beforeStatus}" → "${afterStatus}"`,
      );
    }

    // Sync status via TasksService
    const taskResult = await this.tasksService.syncStatusFromClickUp(
      data.taskId,
      clickupStatus,
    );

    if (!taskResult) {
      this.logger.debug(
        `No task found for ClickUp task ${data.taskId}, ignoring`,
      );
      return;
    }

    const { task: taskInfo, agents } = taskResult;

    // Post status update to Slack thread
    if (taskInfo.slackChannelId && taskInfo.slackThreadTs) {
      await this.slackService.postThreadReply(
        taskInfo.slackChannelId,
        taskInfo.slackThreadTs,
        `📊 *Status updated:* ${clickupStatus}`,
        {
          username: 'ClickUp',
          iconEmoji: ':clipboard:',
        },
      );
    }

    // Emit CONTEXT_UPDATE to group members if status changed
    if (taskInfo.status !== taskInfo.previousStatus) {
      const event = createEvent(EventType.CONTEXT_UPDATE, {
        taskId: taskInfo.id,
        slackChannelId: taskInfo.slackChannelId || '',
        slackThreadTs: taskInfo.slackThreadTs || '',
        messageTs: new Date().toISOString(),
        author: 'ClickUp',
        content: `Status changed from ${taskInfo.previousStatus} to ${taskInfo.status}`,
        isHuman: true, // External system update
      });

      for (const agent of agents) {
        await this.gateway.emitToAgent(agent.id, event);
      }

      this.logger.log(
        `CONTEXT_UPDATE sent to ${agents.length} agents for status change on task ${taskInfo.id}`,
      );
    }

    this.logger.log(`Task ${data.taskId} update processed`);
  }

  /**
   * Handle new comments on tasks.
   */
  private async handleTaskComment(data: ClickUpWebhookJob): Promise<void> {
    this.logger.log(`Task comment: ${data.taskId}`);

    // Find task by ClickUp ID
    const task = await this.prisma.task.findUnique({
      where: { clickupTaskId: data.taskId },
      include: {
        project: {
          include: {
            group: {
              include: {
                members: {
                  include: { agent: true },
                },
              },
            },
          },
        },
      },
    });

    if (!task) {
      this.logger.debug(
        `No task found for ClickUp task ${data.taskId}, ignoring comment`,
      );
      return;
    }

    // Extract comment data from webhook payload
    const historyItems = data.raw.history_items || [];
    const commentItem = historyItems.find(
      (item: { field?: string }) => item.field === 'comment',
    );

    if (commentItem && commentItem.comment) {
      const author = commentItem.user?.username || 'Unknown';
      const content =
        commentItem.comment.text_content ||
        commentItem.comment.comment_text ||
        '';

      // Post comment to Slack thread as the ClickUp user
      if (task.slackChannelId && task.slackThreadTs) {
        const formattedComment = this.slackService.formatCommentForSlack(
          author,
          content,
        );
        await this.slackService.postThreadReply(
          task.slackChannelId,
          task.slackThreadTs,
          formattedComment,
          {
            username: `ClickUp: ${author}`,
            iconEmoji: ':memo:',
          },
        );
        this.logger.log(`Comment synced to Slack thread ${task.slackThreadTs}`);
      }

      // Emit CONTEXT_UPDATE to group agents
      const agents = task.project.group.members
        .map((m) => m.agent)
        .filter((a) => a.isActive);

      const event = createEvent(EventType.CONTEXT_UPDATE, {
        taskId: task.id,
        slackChannelId: task.slackChannelId || '',
        slackThreadTs: task.slackThreadTs || '',
        messageTs: new Date().toISOString(),
        author,
        content,
        isHuman: true,
      });

      for (const agent of agents) {
        await this.gateway.emitToAgent(agent.id, event);
      }
    }

    this.logger.log(`Task ${data.taskId} comment processed`);
  }

  // ==================== Slack Handlers ====================

  private async handleSlackJob(job: Job): Promise<void> {
    const data = job.data as SlackWebhookJob;

    // Skip bot messages (already filtered in controller, but double-check)
    if (data.isBotMessage) {
      this.logger.debug('Skipping bot message');
      return;
    }

    switch (job.name) {
      case SLACK_JOB_TYPES.MESSAGE:
        await this.handleSlackMessage(data);
        break;
      case SLACK_JOB_TYPES.APP_MENTION:
        await this.handleSlackAppMention(data);
        break;
      default:
        this.logger.warn(`Unknown Slack job type: ${job.name}`);
    }
  }

  /**
   * Handle new message in channel/thread.
   *
   * Routes messages from both project channels and group channels to agents.
   * If in a tracked thread, sync to ClickUp and emit CONTEXT_UPDATE.
   */
  private async handleSlackMessage(data: SlackWebhookJob): Promise<void> {
    this.logger.log(
      `Slack message in channel ${data.channelId}${data.threadTs ? ' (thread)' : ''}`,
    );

    // Try to find a project that owns this channel
    const project = await this.prisma.project.findFirst({
      where: { slackChannelId: data.channelId, isActive: true },
      include: {
        group: {
          include: {
            members: {
              where: { agent: { isActive: true } },
              include: {
                agent: {
                  select: {
                    id: true,
                    name: true,
                    clientId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // If not a project channel, check if it's a group channel
    const group = !project
      ? await this.prisma.group.findFirst({
          where: { slackChannelId: data.channelId, isActive: true },
          include: {
            members: {
              where: { agent: { isActive: true } },
              include: {
                agent: {
                  select: {
                    id: true,
                    name: true,
                    clientId: true,
                  },
                },
              },
            },
          },
        })
      : null;

    // If neither project nor group channel, ignore
    if (!project && !group) {
      this.logger.debug(`Message in non-Oblivion channel: ${data.channelId}`);
      return;
    }

    // Determine the group and agents to notify
    const targetGroup = project ? project.group : group!;
    const agentIds = targetGroup.members.map((m) => m.agent.id);

    // If this is a thread message, try to find the associated task
    let task: {
      id: string;
      clickupTaskId: string;
      title: string | null;
    } | null = null;
    if (data.threadTs) {
      task = await this.prisma.task.findFirst({
        where: {
          slackChannelId: data.channelId,
          slackThreadTs: data.threadTs,
        },
        select: {
          id: true,
          clickupTaskId: true,
          title: true,
        },
      });

      // Sync to ClickUp if this is a tracked task thread
      if (task && this.clickUpService.isConfigured()) {
        const author = data.userId || 'Unknown';
        const content = data.text || '';
        const commentText = `[Slack - ${author}] ${content}`;

        const result = await this.clickUpService.postComment(
          task.clickupTaskId,
          commentText,
        );

        if (result) {
          this.logger.log(
            `Message synced to ClickUp task ${task.clickupTaskId}`,
          );
        }
      }
    }

    // Broadcast SLACK_MESSAGE event to all agents in the group
    const payload: SlackMessagePayload = {
      channelId: data.channelId,
      messageTs: data.messageTs,
      threadTs: data.threadTs,
      text: data.text || '',
      user: data.userId || 'unknown',
      taskId: task?.id || undefined,
      taskClickupId: task?.clickupTaskId || undefined,
      projectId: project?.id || '',
      projectName: project?.name || '',
      groupId: targetGroup.id,
      groupName: targetGroup.name,
    };

    const slackMessageEvent = createEvent(EventType.SLACK_MESSAGE, payload);

    const channelType = project ? 'project' : 'group';
    this.logger.log(
      `Broadcasting SLACK_MESSAGE to ${agentIds.length} agents in ${channelType} "${project?.name || targetGroup.name}"`,
    );

    for (const agentId of agentIds) {
      await this.gateway.emitToAgent(agentId, slackMessageEvent);
    }

    // Also emit CONTEXT_UPDATE for backward compatibility (if it's a task thread)
    if (task && data.threadTs) {
      const contextPayload: ContextUpdatePayload = {
        taskId: task.id,
        slackChannelId: data.channelId,
        slackThreadTs: data.threadTs,
        messageTs: data.messageTs,
        author: data.userId || 'Unknown',
        content: data.text || '',
        isHuman: true,
      };

      const contextEvent = createEvent(
        EventType.CONTEXT_UPDATE,
        contextPayload,
      );

      for (const agentId of agentIds) {
        await this.gateway.emitToAgent(agentId, contextEvent);
      }

      this.logger.log(`CONTEXT_UPDATE sent for task thread ${data.threadTs}`);
    }
  }

  /**
   * Handle @bot mentions (potential wake-up command).
   */
  private async handleSlackAppMention(data: SlackWebhookJob): Promise<void> {
    this.logger.log(`Bot mentioned in channel ${data.channelId}`);

    // Find task if in a tracked thread
    if (data.threadTs) {
      const task = await this.prisma.task.findFirst({
        where: {
          slackChannelId: data.channelId,
          slackThreadTs: data.threadTs,
        },
        include: {
          project: {
            include: {
              group: {
                include: {
                  members: {
                    include: { agent: true },
                  },
                },
              },
            },
          },
        },
      });

      if (task) {
        // Emit WAKE_UP event to group agents
        const agents = task.project.group.members
          .map((m) => m.agent)
          .filter((a) => a.isActive);

        const event = createEvent(EventType.WAKE_UP, {
          taskId: task.id,
          slackChannelId: data.channelId,
          slackThreadTs: data.threadTs,
          reason: 'mention',
          triggeredBy: data.userId || 'Unknown',
        });

        for (const agent of agents) {
          const sent = await this.gateway.emitToAgent(agent.id, event);
          if (sent) {
            this.logger.log(`WAKE_UP sent to agent ${agent.id}`);
          }
        }
      }
    }

    this.logger.log(`App mention processed`);
  }
}
