import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebClient, ChatPostMessageResponse, LogLevel } from '@slack/web-api';
import type { KnownBlock } from '@slack/web-api';

/**
 * Task info for creating Slack messages
 */
export interface TaskInfo {
  taskId: string;
  title: string;
  description: string;
  status: string;
  priority: string | null;
  url: string;
  assignees: string[];
  tags: string[];
}

/**
 * Result of posting a message to Slack
 */
export interface SlackMessageResult {
  ok: boolean;
  channelId: string;
  threadTs: string;
  messageTs: string;
}

/**
 * SlackService handles all interactions with the Slack API.
 *
 * Features:
 * - Post "Root Message" with Block Kit for new tasks
 * - Post thread replies
 * - Format messages with rich formatting
 *
 * Authentication:
 * - Uses Bot Token (xoxb-*)
 * - Token configured via SLACK_BOT_TOKEN env var
 *
 * Required Scopes:
 * - chat:write
 * - chat:write.public (for posting to channels bot isn't in)
 */
@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly client: WebClient;
  private readonly botToken: string;

  constructor(private configService: ConfigService) {
    this.botToken = this.configService.get<string>('SLACK_BOT_TOKEN') || '';

    this.client = new WebClient(this.botToken, {
      logLevel: this.configService.get('NODE_ENV') === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
      retryConfig: {
        retries: 3,
      },
    });
  }

  /**
   * Check if the service is configured with a bot token
   */
  isConfigured(): boolean {
    return !!this.botToken;
  }

  /**
   * Post the "Root Message" for a new task
   *
   * Creates a rich Block Kit message with:
   * - Task title and link
   * - Description preview
   * - Status and priority
   * - Action buttons (if applicable)
   *
   * @param channelId - Slack channel ID
   * @param task - Task information
   * @returns Message result with thread_ts for future replies
   */
  async postTaskMessage(channelId: string, task: TaskInfo): Promise<SlackMessageResult | null> {
    if (!this.isConfigured()) {
      this.logger.warn('Slack bot token not configured');
      return null;
    }

    try {
      const blocks = this.buildTaskBlocks(task);

      const result: ChatPostMessageResponse = await this.client.chat.postMessage({
        channel: channelId,
        text: `New Task: ${task.title}`, // Fallback for notifications
        blocks,
        unfurl_links: false,
        unfurl_media: false,
      });

      if (!result.ok || !result.ts) {
        this.logger.error(`Failed to post message: ${result.error}`);
        return null;
      }

      this.logger.log(`Task message posted to ${channelId}, thread_ts: ${result.ts}`);

      return {
        ok: true,
        channelId: result.channel || channelId,
        threadTs: result.ts,
        messageTs: result.ts,
      };
    } catch (error) {
      this.logger.error(`Failed to post task message: ${error}`);
      return null;
    }
  }

  /**
   * Post a reply to an existing thread
   *
   * @param channelId - Slack channel ID
   * @param threadTs - Thread timestamp (parent message ts)
   * @param text - Message text (supports mrkdwn)
   * @param options - Additional options
   * @returns Message result or null on failure
   */
  async postThreadReply(
    channelId: string,
    threadTs: string,
    text: string,
    options: {
      username?: string;
      iconEmoji?: string;
      broadcast?: boolean;
    } = {},
  ): Promise<SlackMessageResult | null> {
    if (!this.isConfigured()) {
      this.logger.warn('Slack bot token not configured');
      return null;
    }

    try {
      const result = await this.client.chat.postMessage({
        channel: channelId,
        thread_ts: threadTs,
        text,
        reply_broadcast: options.broadcast || false,
        username: options.username,
        icon_emoji: options.iconEmoji,
      });

      if (!result.ok || !result.ts) {
        this.logger.error(`Failed to post thread reply: ${result.error}`);
        return null;
      }

      this.logger.log(`Thread reply posted to ${channelId}:${threadTs}`);

      return {
        ok: true,
        channelId: result.channel || channelId,
        threadTs: threadTs,
        messageTs: result.ts,
      };
    } catch (error) {
      this.logger.error(`Failed to post thread reply: ${error}`);
      return null;
    }
  }

  /**
   * Post an agent status update to a thread
   *
   * @param channelId - Slack channel ID
   * @param threadTs - Thread timestamp
   * @param agentName - Name of the agent
   * @param status - Status message
   * @param emoji - Status emoji
   */
  async postAgentStatus(
    channelId: string,
    threadTs: string,
    agentName: string,
    status: string,
    emoji: string = ':robot_face:',
  ): Promise<SlackMessageResult | null> {
    const text = `${emoji} *${agentName}*: ${status}`;
    return this.postThreadReply(channelId, threadTs, text);
  }

  /**
   * Build Block Kit blocks for a task message
   */
  private buildTaskBlocks(task: TaskInfo): KnownBlock[] {
    const blocks: KnownBlock[] = [];

    // Header section with task title
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📋 ${task.title}`,
        emoji: true,
      },
    });

    // Task metadata section
    const metaFields: Array<{ type: 'mrkdwn'; text: string }> = [];

    if (task.status) {
      metaFields.push({
        type: 'mrkdwn',
        text: `*Status:* ${task.status}`,
      });
    }

    if (task.priority) {
      const priorityEmoji = this.getPriorityEmoji(task.priority);
      metaFields.push({
        type: 'mrkdwn',
        text: `*Priority:* ${priorityEmoji} ${task.priority}`,
      });
    }

    if (metaFields.length > 0) {
      blocks.push({
        type: 'section',
        fields: metaFields,
      } as KnownBlock);
    }

    // Description section (truncated)
    if (task.description) {
      const truncatedDesc =
        task.description.length > 500
          ? task.description.substring(0, 500) + '...'
          : task.description;

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: truncatedDesc,
        },
      });
    }

    // Tags section
    if (task.tags.length > 0) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `🏷️ ${task.tags.map((t) => `\`${t}\``).join(' ')}`,
          },
        ],
      });
    }

    // Assignees section
    if (task.assignees.length > 0) {
      blocks.push({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `👤 Assigned to: ${task.assignees.join(', ')}`,
          },
        ],
      });
    }

    // Divider
    blocks.push({ type: 'divider' });

    // Action buttons
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🔗 Open in ClickUp',
            emoji: true,
          },
          url: task.url,
          action_id: 'open_clickup',
        },
      ],
    });

    // Footer context
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_Task ID: ${task.taskId} • Reply in this thread to collaborate_`,
        },
      ],
    });

    return blocks;
  }

  /**
   * Get emoji for priority level
   */
  private getPriorityEmoji(priority: string): string {
    const priorityLower = priority.toLowerCase();
    if (priorityLower === 'urgent') return '🔴';
    if (priorityLower === 'high') return '🟠';
    if (priorityLower === 'normal') return '🟡';
    if (priorityLower === 'low') return '🟢';
    return '⚪';
  }

  /**
   * Format a ClickUp comment for Slack
   *
   * @param author - Comment author name
   * @param content - Comment content
   * @returns Formatted Slack message
   */
  formatCommentForSlack(author: string, content: string): string {
    return `💬 *${author}* commented on ClickUp:\n>${content.split('\n').join('\n>')}`;
  }
}
