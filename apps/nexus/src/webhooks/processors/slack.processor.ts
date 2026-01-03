import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../queue/queue.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentGateway, createEvent, EventType } from '../../gateway';
import type { ContextUpdatePayload } from '../../gateway/dto/events.dto';
import { ClickUpService } from '../../integrations/clickup/clickup.service';
import { SLACK_JOB_TYPES } from '../dto/slack-webhook.dto';
import type { SlackWebhookJob } from '../dto/slack-webhook.dto';

/**
 * SlackProcessor handles Slack Events API jobs from the queue.
 *
 * Processing flow:
 * 1. Parse event data
 * 2. Check if message is in a tracked thread (task_mappings)
 * 3. If tracked, emit CONTEXT_UPDATE to agents
 * 4. Sync message to ClickUp as comment
 *
 * Job types:
 * - slack:message: New message in channel/thread
 * - slack:app-mention: Bot was @mentioned
 * - slack:channel-created: New channel (potential project)
 */
@Processor(QUEUE_NAMES.WEBHOOK_PROCESSING)
export class SlackProcessor extends WorkerHost {
  private readonly logger = new Logger(SlackProcessor.name);

  constructor(
    private prisma: PrismaService,
    private gateway: AgentGateway,
    private clickUpService: ClickUpService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    // Only process Slack jobs
    if (!job.name.startsWith('slack:')) {
      return;
    }

    this.logger.log(`Processing ${job.name} (id: ${job.id})`);

    const data = job.data as SlackWebhookJob;

    // Skip bot messages (already filtered in controller, but double-check)
    if (data.isBotMessage) {
      this.logger.debug('Skipping bot message');
      return;
    }

    try {
      switch (job.name) {
        case SLACK_JOB_TYPES.MESSAGE:
          await this.handleMessage(data);
          break;
        case SLACK_JOB_TYPES.APP_MENTION:
          await this.handleAppMention(data);
          break;
        case SLACK_JOB_TYPES.CHANNEL_CREATED:
          await this.handleChannelCreated(data);
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
   * Handle new messages in channels/threads.
   *
   * Flow:
   * 1. Check if message is in a tracked thread (via task_mappings)
   * 2. If tracked, emit CONTEXT_UPDATE to relevant agents
   * 3. Sync message to ClickUp as comment
   */
  private async handleMessage(data: SlackWebhookJob): Promise<void> {
    this.logger.log(
      `Message in channel ${data.channelId}${data.threadTs ? ` (thread: ${data.threadTs})` : ''}`,
    );

    // Only process thread replies (messages with thread_ts)
    // Root messages are created by Nexus when tasks are created
    if (!data.threadTs) {
      this.logger.debug('Not a thread reply, ignoring');
      return;
    }

    // Find task mapping by channel + thread_ts
    const taskMapping = await this.prisma.taskMapping.findFirst({
      where: {
        slackChannelId: data.channelId,
        slackThreadTs: data.threadTs,
      },
      include: {
        projectMapping: {
          include: { tenant: true },
        },
      },
    });

    if (!taskMapping) {
      this.logger.debug(`No task mapping for thread ${data.threadTs}, ignoring`);
      return;
    }

    this.logger.log(`Message in tracked thread for task ${taskMapping.clickupTaskId}`);

    // Find agents to notify
    const agents = await this.prisma.agent.findMany({
      where: {
        tenantId: taskMapping.projectMapping.tenantId,
        isActive: true,
      },
    });

    // Emit CONTEXT_UPDATE to connected agents
    const payload: ContextUpdatePayload = {
      taskId: taskMapping.id,
      slackChannelId: data.channelId,
      slackThreadTs: data.threadTs,
      messageTs: data.messageTs,
      author: data.userId || 'unknown',
      content: data.text || '',
      isHuman: true, // We already filtered out bot messages
    };

    const event = createEvent(EventType.CONTEXT_UPDATE, payload);

    for (const agent of agents) {
      const sent = await this.gateway.emitToAgent(agent.id, event);
      if (sent) {
        this.logger.log(`CONTEXT_UPDATE sent to agent ${agent.clientId}`);
      }
    }

    // Sync message to ClickUp as comment
    if (data.text && taskMapping.clickupTaskId) {
      // Format the comment with Slack user info
      const slackAuthor = data.userId ? `<@${data.userId}>` : 'Slack User';
      const commentText = `[From Slack - ${slackAuthor}]\n\n${data.text}`;

      const comment = await this.clickUpService.postComment(
        taskMapping.clickupTaskId,
        commentText,
      );

      if (comment) {
        this.logger.log(`Message synced to ClickUp task ${taskMapping.clickupTaskId}`);
      } else {
        this.logger.warn(`Failed to sync message to ClickUp task ${taskMapping.clickupTaskId}`);
      }
    }
  }

  /**
   * Handle @mentions of the bot.
   *
   * Used for direct commands or queries to the bot.
   */
  private async handleAppMention(data: SlackWebhookJob): Promise<void> {
    this.logger.log(`Bot mentioned in channel ${data.channelId}`);

    // Parse the mention text to extract command
    const text = data.text || '';

    // Remove the bot mention from the text
    const commandText = text.replace(/<@[A-Z0-9]+>/g, '').trim();

    this.logger.debug(`Command text: "${commandText}"`);

    // Check if this is in a tracked thread
    if (data.threadTs) {
      const taskMapping = await this.prisma.taskMapping.findFirst({
        where: {
          slackChannelId: data.channelId,
          slackThreadTs: data.threadTs,
        },
        include: {
          projectMapping: {
            include: { tenant: true },
          },
        },
      });

      if (taskMapping) {
        // This is a command in a task thread - notify agents
        const agents = await this.prisma.agent.findMany({
          where: {
            tenantId: taskMapping.projectMapping.tenantId,
            isActive: true,
          },
        });

        const event = createEvent(EventType.WAKE_UP, {
          taskId: taskMapping.id,
          reason: 'mention',
          command: commandText,
        });

        for (const agent of agents) {
          const sent = await this.gateway.emitToAgent(agent.id, event);
          if (sent) {
            this.logger.log(`WAKE_UP sent to agent ${agent.clientId}`);
          }
        }
      }
    }

    this.logger.log(`App mention processed`);
  }

  /**
   * Handle new channel creation.
   *
   * Could be used to suggest project mapping creation.
   */
  private async handleChannelCreated(data: SlackWebhookJob): Promise<void> {
    this.logger.log(`New channel created: ${data.channelId}`);

    // Log for future feature implementation
    // Could notify admins or auto-suggest project mapping
    this.logger.debug(
      `Channel ${data.channelId} created in team ${data.teamId}. ` +
        `Consider creating a project mapping for this channel.`,
    );

    this.logger.log(`Channel created event processed`);
  }
}
