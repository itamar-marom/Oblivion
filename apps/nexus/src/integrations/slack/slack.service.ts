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
 * Result of creating a Slack channel
 */
export interface SlackChannelResult {
  ok: boolean;
  channelId: string;
  channelName: string;
}

/**
 * Individual Slack message
 */
export interface SlackMessage {
  ts: string;
  threadTs?: string;
  user: string;
  username?: string;
  botId?: string;
  text: string;
  type: string;
  createdAt: Date;
}

/**
 * Result of reading thread messages
 */
export interface SlackThreadMessagesResult {
  ok: boolean;
  messages: SlackMessage[];
  hasMore: boolean;
  nextCursor?: string;
  error?: string;
}

/**
 * SlackService handles all interactions with the Slack API.
 *
 * Features:
 * - Create and archive channels for Groups/Projects
 * - Manage channel membership
 * - Post "Root Message" with Block Kit for new tasks
 * - Post thread replies
 * - Format messages with rich formatting
 *
 * Authentication:
 * - Uses Bot Token (xoxb-*)
 * - Token configured via SLACK_BOT_TOKEN env var
 *
 * Required Scopes:
 * - channels:manage (create, archive channels)
 * - chat:write (post messages)
 * - chat:write.customize (**CRITICAL** - enables custom username/icon per agent)
 * - chat:write.public (post to channels bot isn't in)
 * - channels:history (**NEW** - read messages from public channels)
 * - groups:history (**NEW** - read messages from private channels)
 *
 * Optional Scopes (for user mapping features):
 * - channels:write.invites (invite users to channels)
 * - users:read (lookup user IDs)
 * - users:read.email (lookup users by email)
 * - groups:write (for private channels)
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

  // ==================== Channel Management ====================

  /**
   * Create a new Slack channel.
   *
   * Channel naming convention:
   * - Groups: `oblivion-{group-slug}`
   * - Projects: `oblivion-{project-slug}`
   *
   * @param name - Channel name (will be prefixed and sanitized)
   * @param isPrivate - Whether to create a private channel (default: false)
   * @returns Channel info or null on failure
   */
  async createChannel(
    name: string,
    isPrivate = false,
  ): Promise<SlackChannelResult | null> {
    if (!this.isConfigured()) {
      this.logger.warn('Slack bot token not configured');
      return null;
    }

    // Sanitize channel name: lowercase, replace spaces with hyphens, remove special chars
    const sanitizedName = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_]/g, '')
      .substring(0, 80); // Slack limit is 80 chars

    try {
      const result = await this.client.conversations.create({
        name: sanitizedName,
        is_private: isPrivate,
      });

      if (!result.ok || !result.channel) {
        this.logger.error(`Failed to create channel: ${result.error}`);
        return null;
      }

      this.logger.log(`Channel created: ${result.channel.name} (${result.channel.id})`);

      return {
        ok: true,
        channelId: result.channel.id!,
        channelName: result.channel.name!,
      };
    } catch (error: unknown) {
      const slackError = error as { data?: { error?: string } };
      // Handle "name_taken" error - channel already exists
      if (slackError.data?.error === 'name_taken') {
        this.logger.warn(`Channel "${sanitizedName}" already exists, attempting to find it`);
        return this.findChannelByName(sanitizedName);
      }
      this.logger.error(`Failed to create channel "${sanitizedName}": ${error}`);
      return null;
    }
  }

  /**
   * Find an existing channel by name.
   *
   * @param name - Channel name to search for
   * @returns Channel info or null if not found
   */
  async findChannelByName(name: string): Promise<SlackChannelResult | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      // Search through public channels
      let cursor: string | undefined;
      do {
        const result = await this.client.conversations.list({
          types: 'public_channel,private_channel',
          limit: 200,
          cursor,
        });

        if (result.channels) {
          const channel = result.channels.find((c) => c.name === name);
          if (channel) {
            return {
              ok: true,
              channelId: channel.id!,
              channelName: channel.name!,
            };
          }
        }

        cursor = result.response_metadata?.next_cursor;
      } while (cursor);

      return null;
    } catch (error) {
      this.logger.error(`Failed to find channel "${name}": ${error}`);
      return null;
    }
  }

  /**
   * Archive a Slack channel.
   *
   * @param channelId - Channel ID to archive
   * @returns true if successful, false otherwise
   */
  async archiveChannel(channelId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn('Slack bot token not configured');
      return false;
    }

    try {
      const result = await this.client.conversations.archive({
        channel: channelId,
      });

      if (!result.ok) {
        this.logger.error(`Failed to archive channel: ${result.error}`);
        return false;
      }

      this.logger.log(`Channel archived: ${channelId}`);
      return true;
    } catch (error: unknown) {
      const slackError = error as { data?: { error?: string } };
      // Already archived is okay
      if (slackError.data?.error === 'already_archived') {
        this.logger.debug(`Channel ${channelId} already archived`);
        return true;
      }
      this.logger.error(`Failed to archive channel ${channelId}: ${error}`);
      return false;
    }
  }

  /**
   * Unarchive a Slack channel.
   *
   * @param channelId - Channel ID to unarchive
   * @returns true if successful, false otherwise
   */
  async unarchiveChannel(channelId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn('Slack bot token not configured');
      return false;
    }

    try {
      const result = await this.client.conversations.unarchive({
        channel: channelId,
      });

      if (!result.ok) {
        this.logger.error(`Failed to unarchive channel: ${result.error}`);
        return false;
      }

      this.logger.log(`Channel unarchived: ${channelId}`);
      return true;
    } catch (error: unknown) {
      const slackError = error as { data?: { error?: string } };
      // Not archived is okay
      if (slackError.data?.error === 'not_archived') {
        this.logger.debug(`Channel ${channelId} is not archived`);
        return true;
      }
      this.logger.error(`Failed to unarchive channel ${channelId}: ${error}`);
      return false;
    }
  }

  // ==================== Channel Membership ====================

  /**
   * Invite a user to a channel.
   *
   * @param channelId - Channel ID
   * @param userId - Slack user ID
   * @returns true if successful, false otherwise
   */
  async inviteUserToChannel(channelId: string, userId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn('Slack bot token not configured');
      return false;
    }

    try {
      const result = await this.client.conversations.invite({
        channel: channelId,
        users: userId,
      });

      if (!result.ok) {
        this.logger.error(`Failed to invite user: ${result.error}`);
        return false;
      }

      this.logger.log(`User ${userId} invited to channel ${channelId}`);
      return true;
    } catch (error: unknown) {
      const slackError = error as { data?: { error?: string } };
      // Already in channel is okay
      if (slackError.data?.error === 'already_in_channel') {
        this.logger.debug(`User ${userId} already in channel ${channelId}`);
        return true;
      }
      this.logger.error(`Failed to invite user ${userId} to channel ${channelId}: ${error}`);
      return false;
    }
  }

  /**
   * Remove a user from a channel.
   *
   * @param channelId - Channel ID
   * @param userId - Slack user ID
   * @returns true if successful, false otherwise
   */
  async removeUserFromChannel(channelId: string, userId: string): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.warn('Slack bot token not configured');
      return false;
    }

    try {
      const result = await this.client.conversations.kick({
        channel: channelId,
        user: userId,
      });

      if (!result.ok) {
        this.logger.error(`Failed to remove user: ${result.error}`);
        return false;
      }

      this.logger.log(`User ${userId} removed from channel ${channelId}`);
      return true;
    } catch (error: unknown) {
      const slackError = error as { data?: { error?: string } };
      // Not in channel is okay
      if (slackError.data?.error === 'not_in_channel') {
        this.logger.debug(`User ${userId} not in channel ${channelId}`);
        return true;
      }
      this.logger.error(`Failed to remove user ${userId} from channel ${channelId}: ${error}`);
      return false;
    }
  }

  /**
   * Look up a Slack user by email.
   *
   * @param email - User's email address
   * @returns Slack user ID or null if not found
   */
  async findUserByEmail(email: string): Promise<string | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const result = await this.client.users.lookupByEmail({
        email,
      });

      if (!result.ok || !result.user) {
        return null;
      }

      return result.user.id || null;
    } catch (error) {
      this.logger.debug(`User not found for email ${email}`);
      return null;
    }
  }

  /**
   * Post a welcome message to a newly created channel.
   *
   * @param channelId - Channel ID
   * @param type - 'group' or 'project'
   * @param name - Group or project name
   */
  async postWelcomeMessage(
    channelId: string,
    type: 'group' | 'project',
    name: string,
  ): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    const emoji = type === 'group' ? '👥' : '📁';
    const text =
      type === 'group'
        ? `${emoji} *Welcome to the ${name} team channel!*\n\nThis channel was automatically created by Oblivion for team coordination.\n\n• Task notifications will appear here\n• Collaborate with your team members\n• Reply to task threads to update context`
        : `${emoji} *Welcome to the ${name} project channel!*\n\nThis channel was automatically created by Oblivion for project work.\n\n• New tasks with \`@${name}\` tag will appear here\n• Claim tasks and update progress\n• All context is synced with ClickUp`;

    try {
      await this.client.chat.postMessage({
        channel: channelId,
        text,
        unfurl_links: false,
      });
    } catch (error) {
      this.logger.error(`Failed to post welcome message: ${error}`);
    }
  }

  // ==================== Message Posting ====================

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
   * Post a simple message to a channel (creates a new thread root)
   *
   * @param channelId - Slack channel ID
   * @param text - Message text (supports mrkdwn)
   * @returns Message result with messageTs for future thread replies, or null on failure
   */
  async postMessage(channelId: string, text: string): Promise<SlackMessageResult | null> {
    if (!this.isConfigured()) {
      this.logger.warn('Slack bot token not configured');
      return null;
    }

    try {
      const result = await this.client.chat.postMessage({
        channel: channelId,
        text,
        unfurl_links: false,
        unfurl_media: false,
      });

      if (!result.ok || !result.ts) {
        this.logger.error(`Failed to post message: ${result.error}`);
        return null;
      }

      this.logger.log(`Message posted to ${channelId}, ts: ${result.ts}`);

      return {
        ok: true,
        channelId: result.channel || channelId,
        threadTs: result.ts,
        messageTs: result.ts,
      };
    } catch (error) {
      this.logger.error(`Failed to post message: ${error}`);
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
   * Get a unique emoji for an agent based on their capabilities.
   * Makes agents visually distinct in Slack.
   *
   * @param capabilities - Agent's capability list
   * @returns Emoji string (e.g., ':robot_face:', ':hammer_and_wrench:')
   */
  getAgentEmoji(capabilities: string[]): string {
    // Match capabilities to relevant emojis
    if (capabilities.includes('code')) return ':technologist:';
    if (capabilities.includes('review')) return ':mag:';
    if (capabilities.includes('test')) return ':white_check_mark:';
    if (capabilities.includes('deploy')) return ':rocket:';
    if (capabilities.includes('security')) return ':shield:';
    if (capabilities.includes('infrastructure')) return ':gear:';
    if (capabilities.includes('automation')) return ':robot_face:';
    if (capabilities.includes('documentation')) return ':books:';
    if (capabilities.includes('design')) return ':art:';

    // Default for agents without specific capabilities
    return ':robot_face:';
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

  // ==================== Message Reading ====================

  /**
   * Get messages from a Slack thread.
   * Reads the parent message and all replies.
   *
   * Rate Limits (new non-Marketplace apps as of 2025):
   * - 1 request per minute
   * - Max 15 messages per request
   *
   * @param channelId - Slack channel ID
   * @param threadTs - Thread timestamp (parent message ts)
   * @param limit - Maximum messages to retrieve (default: 15, max: 15)
   * @param cursor - Pagination cursor for fetching more messages
   * @returns Thread messages or null on failure
   */
  async getThreadMessages(
    channelId: string,
    threadTs: string,
    limit: number = 15,
    cursor?: string,
  ): Promise<SlackThreadMessagesResult | null> {
    if (!this.isConfigured()) {
      this.logger.warn('Slack bot token not configured');
      return null;
    }

    // Enforce limit for new non-Marketplace apps
    const effectiveLimit = Math.min(limit, 15);

    try {
      const result = await this.client.conversations.replies({
        channel: channelId,
        ts: threadTs,
        limit: effectiveLimit,
        cursor,
        inclusive: true, // Include parent message
      });

      if (!result.ok || !result.messages) {
        this.logger.error(`Failed to read thread: ${result.error}`);
        return {
          ok: false,
          messages: [],
          hasMore: false,
          error: result.error,
        };
      }

      // Transform messages to our format
      const messages: SlackMessage[] = result.messages.map((msg) => ({
        ts: msg.ts!,
        threadTs: msg.thread_ts,
        user: msg.user || msg.bot_id || 'unknown',
        username: (msg as any).username, // Custom username if set via chat:write.customize
        botId: msg.bot_id,
        text: msg.text || '',
        type: msg.type || 'message',
        createdAt: new Date(parseFloat(msg.ts!) * 1000),
      }));

      this.logger.log(
        `Read ${messages.length} messages from thread ${channelId}:${threadTs}`,
      );

      return {
        ok: true,
        messages,
        hasMore: !!result.response_metadata?.next_cursor,
        nextCursor: result.response_metadata?.next_cursor,
      };
    } catch (error: unknown) {
      const slackError = error as { data?: { error?: string } };

      // Handle specific errors
      if (slackError.data?.error === 'thread_not_found') {
        this.logger.warn(`Thread not found: ${channelId}:${threadTs}`);
        return {
          ok: false,
          messages: [],
          hasMore: false,
          error: 'thread_not_found',
        };
      }

      if (slackError.data?.error === 'ratelimited') {
        this.logger.warn(`Rate limited reading thread ${channelId}:${threadTs}`);
        return {
          ok: false,
          messages: [],
          hasMore: false,
          error: 'rate_limited',
        };
      }

      this.logger.error(`Failed to read thread: ${error}`);
      return {
        ok: false,
        messages: [],
        hasMore: false,
        error: 'unknown_error',
      };
    }
  }
}
