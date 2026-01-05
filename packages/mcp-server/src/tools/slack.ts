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
}
