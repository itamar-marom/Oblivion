/**
 * Task Management Tools
 *
 * MCP tools for listing, claiming, and updating tasks in Nexus.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NexusClient } from '../nexus-client.js';

/**
 * Register task-related tools with the MCP server
 */
export function registerTaskTools(server: McpServer, nexus: NexusClient): void {
  // =========================================================================
  // list_available_tasks
  // =========================================================================
  server.tool(
    'list_available_tasks',
    'Get unclaimed tasks available for you to claim. Returns tasks with their priority, project, and group info.',
    {},
    async () => {
      try {
        const tasks = await nexus.getAvailableTasks();

        if (tasks.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No tasks available for claiming at the moment.',
              },
            ],
          };
        }

        const taskList = tasks
          .map(
            (t, i) =>
              `${i + 1}. **${t.title}**\n` +
              `   - Task ID: \`${t.taskId}\`\n` +
              `   - Priority: ${getPriorityLabel(t.priority)}\n` +
              `   - Project: ${t.projectName} (${t.groupName})\n` +
              `   - Created: ${new Date(t.createdAt).toLocaleString()}`
          )
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `## Available Tasks (${tasks.length})\n\n${taskList}\n\nUse \`claim_task\` with the Task ID to claim a task.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching available tasks: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // =========================================================================
  // list_claimed_tasks
  // =========================================================================
  server.tool(
    'list_claimed_tasks',
    'Get tasks you have claimed and are working on.',
    {},
    async () => {
      try {
        const tasks = await nexus.getClaimedTasks();

        if (tasks.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'You have no claimed tasks. Use `list_available_tasks` to find tasks to work on.',
              },
            ],
          };
        }

        const taskList = tasks
          .map(
            (t, i) =>
              `${i + 1}. **${t.title}**\n` +
              `   - Task ID: \`${t.id}\`\n` +
              `   - Status: ${t.status}\n` +
              `   - Priority: ${getPriorityLabel(t.priority)}\n` +
              `   - Project: ${t.project?.name || 'Unknown'}\n` +
              `   - Claimed: ${t.claimedAt ? new Date(t.claimedAt).toLocaleString() : 'Unknown'}`
          )
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `## Your Claimed Tasks (${tasks.length})\n\n${taskList}\n\nUse \`update_task_status\` to change task status.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching claimed tasks: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // =========================================================================
  // claim_task
  // =========================================================================
  server.tool(
    'claim_task',
    'Claim a task to work on it. Only unclaimed tasks can be claimed.',
    {
      taskId: z.string().describe('The task ID to claim (from list_available_tasks)'),
    },
    async ({ taskId }) => {
      try {
        const result = await nexus.claimTask(taskId);

        if (result.success) {
          return {
            content: [
              {
                type: 'text',
                text: `Successfully claimed task \`${taskId}\`!\n\n` +
                  `Claimed at: ${result.claimedAt}\n\n` +
                  `You can now:\n` +
                  `- Use \`get_task_context\` to get full task details\n` +
                  `- Use \`update_task_status\` to mark progress\n` +
                  `- Use \`post_to_slack_thread\` to communicate updates`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to claim task \`${taskId}\`: ${result.error || 'Unknown error'}`,
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
              text: `Error claiming task: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // =========================================================================
  // update_task_status
  // =========================================================================
  server.tool(
    'update_task_status',
    'Update the status of a task you have claimed.',
    {
      taskId: z.string().describe('The task ID to update'),
      status: z
        .enum(['IN_PROGRESS', 'BLOCKED_ON_HUMAN', 'DONE'])
        .describe('New status: IN_PROGRESS (working), BLOCKED_ON_HUMAN (need human input), DONE (completed)'),
    },
    async ({ taskId, status }) => {
      try {
        const result = await nexus.updateTaskStatus(taskId, status);

        const statusEmoji = {
          IN_PROGRESS: '🔄',
          BLOCKED_ON_HUMAN: '⏸️',
          DONE: '✅',
        }[status];

        return {
          content: [
            {
              type: 'text',
              text: `${statusEmoji} Task status updated!\n\n` +
                `- Task ID: \`${result.id}\`\n` +
                `- New Status: **${result.status}**\n` +
                `- Updated: ${new Date(result.updatedAt).toLocaleString()}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error updating task status: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // =========================================================================
  // create_task
  // =========================================================================
  server.tool(
    'create_task',
    'Create a new task in a project. Requires projectId and title.',
    {
      projectId: z.string().describe('The project ID to create the task in'),
      title: z.string().describe('The title of the task'),
      priority: z
        .number()
        .min(1)
        .max(4)
        .optional()
        .describe('Priority 1-4 (1=Urgent, 2=High, 3=Normal, 4=Low). Defaults to 3.'),
    },
    async ({ projectId, title, priority }) => {
      try {
        const task = await nexus.createTask(projectId, title, priority);

        return {
          content: [
            {
              type: 'text',
              text: `Task created successfully!\n\n` +
                `- **Title:** ${task.title}\n` +
                `- **Task ID:** \`${task.id}\`\n` +
                `- **ClickUp ID:** \`${task.clickupTaskId}\`\n` +
                `- **Priority:** ${getPriorityLabel(task.priority)}\n` +
                `- **Status:** ${task.status}\n` +
                `- **Project:** ${task.project?.name || 'Unknown'}\n\n` +
                `Use \`claim_task\` to claim this task.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error creating task: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // =========================================================================
  // get_task_context
  // =========================================================================
  server.tool(
    'get_task_context',
    'Get detailed context for a task including description, project info, and Slack thread details.',
    {
      taskId: z.string().describe('The task ID or ClickUp task ID'),
    },
    async ({ taskId }) => {
      try {
        // Try by internal ID first, then by ClickUp ID
        let task;
        try {
          task = await nexus.getTaskById(taskId);
        } catch {
          task = await nexus.getTask(taskId);
        }

        const sections = [
          `## ${task.title}`,
          '',
          `**Status:** ${task.status}`,
          `**Priority:** ${getPriorityLabel(task.priority)}`,
          `**Task ID:** \`${task.id}\``,
          `**ClickUp ID:** \`${task.clickupTaskId}\``,
          '',
        ];

        if (task.description) {
          sections.push('### Description', '', task.description, '');
        }

        if (task.project) {
          sections.push(
            '### Project',
            '',
            `- **Name:** ${task.project.name}`,
            `- **Slug:** ${task.project.slug}`,
            task.project.oblivionTag ? `- **@Tag:** @${task.project.oblivionTag}` : '',
            task.project.group ? `- **Group:** ${task.project.group.name}` : '',
            ''
          );
        }

        if (task.claimedByAgent) {
          sections.push(
            '### Claimed By',
            '',
            `- **Agent:** ${task.claimedByAgent.name}`,
            `- **Claimed At:** ${task.claimedAt ? new Date(task.claimedAt).toLocaleString() : 'Unknown'}`,
            ''
          );
        }

        if (task.slackChannelId && task.slackThreadTs) {
          sections.push(
            '### Slack Thread',
            '',
            `- **Channel ID:** ${task.slackChannelId}`,
            `- **Thread TS:** ${task.slackThreadTs}`,
            '',
            'Use `post_to_slack_thread` to send updates to the thread.',
            ''
          );
        }

        sections.push(
          '### Timeline',
          '',
          `- **Created:** ${new Date(task.createdAt).toLocaleString()}`,
          `- **Updated:** ${new Date(task.updatedAt).toLocaleString()}`
        );

        return {
          content: [
            {
              type: 'text',
              text: sections.filter(Boolean).join('\n'),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching task context: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Convert priority number to human-readable label
 */
function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 1:
      return '🔴 Urgent';
    case 2:
      return '🟠 High';
    case 3:
      return '🟡 Normal';
    case 4:
      return '🟢 Low';
    default:
      return `Priority ${priority}`;
  }
}
