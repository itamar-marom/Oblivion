import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../queue/queue.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentGateway, createEvent, EventType } from '../../gateway';
import type { TaskAssignedPayload } from '../../gateway/dto/events.dto';
import { ClickUpService } from '../../integrations/clickup/clickup.service';
import { SlackService } from '../../integrations/slack/slack.service';
import { CLICKUP_JOB_TYPES } from '../dto/clickup-webhook.dto';
import type { ClickUpWebhookJob } from '../dto/clickup-webhook.dto';

/**
 * ClickUpProcessor handles ClickUp webhook jobs from the queue.
 *
 * Processing flow:
 * 1. Parse webhook data
 * 2. Fetch full task details from ClickUp API
 * 3. Find project mapping (ClickUp List → Slack Channel)
 * 4. Parse @mentions to identify target agents
 * 5. Create Slack "Root Message" thread
 * 6. Store task mapping in database
 * 7. Emit WebSocket event to agents
 *
 * Job types:
 * - clickup:task-created: New task assigned to agent
 * - clickup:task-updated: Task status/properties changed
 * - clickup:task-comment: Human commented on task
 */
@Processor(QUEUE_NAMES.WEBHOOK_PROCESSING)
export class ClickUpProcessor extends WorkerHost {
  private readonly logger = new Logger(ClickUpProcessor.name);

  constructor(
    private prisma: PrismaService,
    private gateway: AgentGateway,
    private clickUpService: ClickUpService,
    private slackService: SlackService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    // Only process ClickUp jobs
    if (!job.name.startsWith('clickup:')) {
      return;
    }

    this.logger.log(`Processing ${job.name} (id: ${job.id})`);

    const data = job.data as ClickUpWebhookJob;

    try {
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
          this.logger.warn(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process ${job.name}: ${error}`);
      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Handle new task creation.
   *
   * Flow:
   * 1. Fetch full task details from ClickUp API
   * 2. Find project mapping by list_id
   * 3. Parse @mentions in description to find target agents
   * 4. Create Slack "Root Message" thread
   * 5. Store task mapping in database
   * 6. Emit TASK_ASSIGNED to connected agents
   */
  private async handleTaskCreated(data: ClickUpWebhookJob): Promise<void> {
    this.logger.log(`Task created: ${data.taskId}`);

    // Fetch full task details from ClickUp API
    const task = await this.clickUpService.getTask(data.taskId);

    if (!task) {
      this.logger.warn(`Could not fetch task ${data.taskId} from ClickUp API`);
      // Fall back to webhook data if API fails
    }

    // Get list_id from task or webhook
    const listId = task?.list?.id || data.listId;

    if (!listId) {
      this.logger.warn(`No list_id for task ${data.taskId}, skipping`);
      return;
    }

    // Find project mapping by list_id
    const projectMapping = await this.prisma.projectMapping.findUnique({
      where: { clickupListId: listId },
      include: { tenant: true },
    });

    if (!projectMapping) {
      this.logger.debug(`No project mapping for ClickUp list ${listId}, ignoring`);
      return;
    }

    // Parse @mentions from task description
    const description = task?.text_content || task?.description || '';
    const mentions = this.clickUpService.parseMentions(description);
    this.logger.debug(`Found mentions: ${mentions.join(', ') || 'none'}`);

    // Resolve mentions to agents via aliases
    let targetAgentIds: string[] = [];

    if (mentions.length > 0) {
      // Find agent aliases that match the mentions
      const aliases = await this.prisma.agentAlias.findMany({
        where: {
          tenantId: projectMapping.tenantId,
          alias: { in: mentions },
        },
        include: {
          agents: true,
        },
      });

      // Collect unique agent IDs from matched aliases
      const agentIdSet = new Set<string>();
      for (const alias of aliases) {
        for (const agent of alias.agents) {
          if (agent.isActive) {
            agentIdSet.add(agent.id);
          }
        }
      }
      targetAgentIds = [...agentIdSet];

      this.logger.debug(
        `Resolved ${mentions.length} mentions to ${targetAgentIds.length} agents`,
      );
    }

    // If no specific agents mentioned, notify all active agents in tenant
    if (targetAgentIds.length === 0) {
      const allAgents = await this.prisma.agent.findMany({
        where: {
          tenantId: projectMapping.tenantId,
          isActive: true,
        },
        select: { id: true },
      });
      targetAgentIds = allAgents.map((a) => a.id);
      this.logger.debug(`No specific mentions, notifying all ${targetAgentIds.length} agents`);
    }

    // Create Slack "Root Message" thread
    let slackThreadTs = `placeholder-${Date.now()}`;

    if (task) {
      const taskSummary = this.clickUpService.extractTaskSummary(task);
      const slackResult = await this.slackService.postTaskMessage(
        projectMapping.slackChannelId,
        {
          taskId: data.taskId,
          ...taskSummary,
        },
      );

      if (slackResult) {
        slackThreadTs = slackResult.threadTs;
        this.logger.log(`Slack thread created: ${slackThreadTs}`);
      } else {
        this.logger.warn('Failed to create Slack thread, using placeholder');
      }
    }

    // Create/update task mapping in database
    const taskMapping = await this.prisma.taskMapping.upsert({
      where: { clickupTaskId: data.taskId },
      update: {
        slackThreadTs,
        updatedAt: new Date(),
      },
      create: {
        projectMappingId: projectMapping.id,
        clickupTaskId: data.taskId,
        slackChannelId: projectMapping.slackChannelId,
        slackThreadTs,
        status: 'TODO',
      },
    });

    this.logger.log(
      `Task mapping created/updated: ${taskMapping.id} (ClickUp: ${data.taskId} → Slack: ${slackThreadTs})`,
    );

    // Emit TASK_ASSIGNED to connected agents
    const payload: TaskAssignedPayload = {
      taskId: taskMapping.id,
      projectMappingId: projectMapping.id,
      clickupTaskId: data.taskId,
      slackChannelId: projectMapping.slackChannelId,
      slackThreadTs: taskMapping.slackThreadTs,
      title: task?.name || `Task ${data.taskId}`,
      description: task?.text_content || task?.description,
      assignedAt: new Date().toISOString(),
    };

    const event = createEvent(EventType.TASK_ASSIGNED, payload);

    // Fetch full agent records for logging
    const agents = await this.prisma.agent.findMany({
      where: { id: { in: targetAgentIds } },
    });

    for (const agent of agents) {
      const sent = await this.gateway.emitToAgent(agent.id, event);
      if (sent) {
        this.logger.log(`TASK_ASSIGNED sent to agent ${agent.clientId}`);
      }
    }
  }

  /**
   * Handle task updates (status changes, etc.).
   */
  private async handleTaskUpdated(data: ClickUpWebhookJob): Promise<void> {
    this.logger.log(`Task updated: ${data.taskId}`);

    // Find existing task mapping
    const taskMapping = await this.prisma.taskMapping.findUnique({
      where: { clickupTaskId: data.taskId },
      include: {
        projectMapping: {
          include: { tenant: true },
        },
      },
    });

    if (!taskMapping) {
      this.logger.debug(`No task mapping for ClickUp task ${data.taskId}, ignoring`);
      return;
    }

    // Fetch updated task from ClickUp
    const task = await this.clickUpService.getTask(data.taskId);

    if (task) {
      // Update status in database based on ClickUp status
      const clickupStatus = task.status.status.toUpperCase();
      let dbStatus: 'TODO' | 'IN_PROGRESS' | 'BLOCKED_ON_HUMAN' | 'DONE' = 'TODO';

      if (clickupStatus.includes('PROGRESS') || clickupStatus.includes('REVIEW')) {
        dbStatus = 'IN_PROGRESS';
      } else if (clickupStatus.includes('DONE') || clickupStatus.includes('COMPLETE')) {
        dbStatus = 'DONE';
      } else if (clickupStatus.includes('BLOCK')) {
        dbStatus = 'BLOCKED_ON_HUMAN';
      }

      if (taskMapping.status !== dbStatus) {
        await this.prisma.taskMapping.update({
          where: { id: taskMapping.id },
          data: { status: dbStatus },
        });
        this.logger.log(`Task ${data.taskId} status updated to ${dbStatus}`);
      }

      // Post status update to Slack thread
      await this.slackService.postThreadReply(
        taskMapping.slackChannelId,
        taskMapping.slackThreadTs,
        `📊 *Status updated:* ${task.status.status}`,
      );
    }

    this.logger.log(`Task ${data.taskId} update processed`);
  }

  /**
   * Handle new comments on tasks.
   */
  private async handleTaskComment(data: ClickUpWebhookJob): Promise<void> {
    this.logger.log(`Task comment: ${data.taskId}`);

    // Find existing task mapping
    const taskMapping = await this.prisma.taskMapping.findUnique({
      where: { clickupTaskId: data.taskId },
      include: {
        projectMapping: {
          include: { tenant: true },
        },
      },
    });

    if (!taskMapping) {
      this.logger.debug(`No task mapping for ClickUp task ${data.taskId}, ignoring comment`);
      return;
    }

    // Extract comment data from webhook payload
    const historyItems = data.raw.history_items || [];
    const commentItem = historyItems.find(
      (item: { field?: string }) => item.field === 'comment',
    );

    if (commentItem && commentItem.comment) {
      const author = commentItem.user?.username || 'Unknown';
      const content = commentItem.comment.text_content || commentItem.comment.comment_text || '';

      // Post comment to Slack thread
      const formattedComment = this.slackService.formatCommentForSlack(author, content);
      await this.slackService.postThreadReply(
        taskMapping.slackChannelId,
        taskMapping.slackThreadTs,
        formattedComment,
      );

      this.logger.log(`Comment synced to Slack thread ${taskMapping.slackThreadTs}`);

      // Emit CONTEXT_UPDATE to agents
      const agents = await this.prisma.agent.findMany({
        where: {
          tenantId: taskMapping.projectMapping.tenantId,
          isActive: true,
        },
      });

      const event = createEvent(EventType.CONTEXT_UPDATE, {
        taskId: taskMapping.id,
        slackChannelId: taskMapping.slackChannelId,
        slackThreadTs: taskMapping.slackThreadTs,
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
}
