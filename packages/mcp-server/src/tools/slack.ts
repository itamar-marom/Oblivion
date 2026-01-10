/**
 * Slack Communication Tools
 *
 * MCP tools for posting messages to Slack threads via Nexus.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NexusClient } from '../nexus-client.js';

/**
 * Register Slack-related tools with the MCP server
 */
export function registerSlackTools(server: McpServer, nexus: NexusClient): void {
  // =========================================================================
  // post_to_slack_thread
  // =========================================================================
  server.tool(
    'post_to_slack_thread',
    'Post a message to a task\'s Slack thread. Use this to communicate updates, ask questions, or report completion.',
    {
      taskId: z.string().describe('The task ID whose Slack thread to post to'),
      message: z.string().describe('The message to post'),
      broadcast: z
        .boolean()
        .optional()
        .describe('If true, also posts to the channel (not just the thread)'),
    },
    async ({ taskId, message, broadcast }) => {
      try {
        const result = await nexus.postToSlackThread(taskId, message, broadcast);

        if (result.ok) {
          return {
            content: [
              {
                type: 'text',
                text:
                  `Message posted to Slack thread!\n\n` +
                  `- Channel: ${result.channelId}\n` +
                  `- Message TS: ${result.messageTs}\n` +
                  (broadcast ? `- Broadcast to channel: Yes` : ''),
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to post to Slack: ${result.error || 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error posting to Slack: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // =========================================================================
  // get_task_slack_thread
  // =========================================================================
  server.tool(
    'get_task_slack_thread',
    'Read messages from a task\'s Slack thread. Returns the last 15 messages (or specified limit) from the thread. Use this to understand conversation context before posting.',
    {
      taskId: z.string().describe('The task ID whose Slack thread to read'),
      limit: z
        .number()
        .min(1)
        .max(15)
        .optional()
        .describe('Maximum number of messages to retrieve (default: 15, max: 15)'),
      cursor: z
        .string()
        .optional()
        .describe('Pagination cursor from previous request (for fetching older messages)'),
    },
    async ({ taskId, limit, cursor }) => {
      try {
        const result = await nexus.getTaskSlackThread(taskId, limit, cursor);

        if (result.ok) {
          // Format messages for display
          const formattedMessages = result.messages
            .map((msg) => {
              const timestamp = new Date(msg.createdAt).toLocaleString();
              const author = msg.username || msg.user;
              const indicator = msg.botId ? '🤖' : '👤';
              return `${indicator} **${author}** (${timestamp}):\n${msg.text}`;
            })
            .join('\n\n---\n\n');

          return {
            content: [
              {
                type: 'text',
                text:
                  `## Slack Thread for Task: ${result.title || result.clickupTaskId}\n\n` +
                  `**Project:** ${result.projectName} (Group: ${result.groupName})\n` +
                  `**Channel:** ${result.channelId}\n` +
                  `**Thread:** ${result.threadTs}\n` +
                  (result.claimedBy ? `**Claimed by:** ${result.claimedBy}\n` : '') +
                  `**Messages:** ${result.messages.length}\n` +
                  (result.hasMore ? `**More available:** Yes (use cursor: \`${result.nextCursor}\`)\n` : '') +
                  `\n${'='.repeat(60)}\n\n` +
                  formattedMessages,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to read Slack thread: ${result.error || 'Unknown error'}`,
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        let errorMessage = error instanceof Error ? error.message : String(error);

        // Provide helpful context for common errors
        if (errorMessage.includes('not found')) {
          errorMessage += '\n\nThis task may not have a Slack thread yet. Try posting a message first with post_to_slack_thread.';
        } else if (errorMessage.includes('rate limit')) {
          errorMessage += '\n\nSlack API rate limit reached. Please wait 1 minute before trying again.';
        } else if (errorMessage.includes('only read threads')) {
          errorMessage += '\n\nYou can only read threads for tasks in groups you belong to.';
        }

        return {
          content: [
            {
              type: 'text',
              text: `Error reading Slack thread: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
