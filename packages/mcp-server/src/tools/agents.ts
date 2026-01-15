/**
 * Agent and Dashboard Tools
 *
 * MCP tools for viewing agents, projects, and system stats.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NexusClient } from '../nexus-client.js';
import { getEffectiveCredentials } from '../credentials-manager.js';

/**
 * Register agent and dashboard tools with the MCP server
 */
export function registerAgentTools(server: McpServer, nexus: NexusClient): void {
  // =========================================================================
  // whoami
  // =========================================================================
  server.tool(
    'whoami',
    'Get information about your current agent identity and configuration.',
    {},
    async () => {
      try {
        const creds = await getEffectiveCredentials();

        if (!creds.clientId) {
          return {
            content: [
              {
                type: 'text',
                text: '## Not Authenticated\n\n' +
                  'No agent credentials configured.\n\n' +
                  'Use `register_agent` to register a new agent.',
              },
            ],
          };
        }

        // Try to get full agent details from API
        try {
          const agents = await nexus.getAgents();
          const myAgent = agents.find(a => a.clientId === creds.clientId);

          if (myAgent) {
            return {
              content: [
                {
                  type: 'text',
                  text:
                    `## Current Agent Identity\n\n` +
                    `**Name:** ${myAgent.name}\n` +
                    `**Client ID:** \`${myAgent.clientId}\`\n` +
                    `**Status:** ${myAgent.connectionStatus}\n` +
                    `**Capabilities:** ${myAgent.capabilities.join(', ')}\n` +
                    `**Nexus URL:** ${creds.nexusUrl}\n\n` +
                    `You are ${myAgent.isConnected ? '**connected** 🟢' : 'offline ⚫'} to Nexus.`,
                },
              ],
            };
          }
        } catch {
          // API call failed, return basic info from credentials
        }

        // Fallback: just show credentials
        return {
          content: [
            {
              type: 'text',
              text:
                `## Current Agent Identity\n\n` +
                `**Client ID:** \`${creds.clientId}\`\n` +
                `**Nexus URL:** ${creds.nexusUrl}\n\n` +
                `(Connected, but unable to fetch full details)`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error getting agent info: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // =========================================================================
  // list_agents
  // =========================================================================
  server.tool(
    'list_agents',
    'List all agents in the system with their connection status.',
    {},
    async () => {
      try {
        const agents = await nexus.getAgents();

        if (agents.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No agents found in the system.',
              },
            ],
          };
        }

        const connected = agents.filter((a) => a.isConnected);
        const offline = agents.filter((a) => !a.isConnected);

        const formatAgent = (a: typeof agents[0]) => {
          const statusEmoji = getStatusEmoji(a.connectionStatus);
          return (
            `- ${statusEmoji} **${a.name}** (\`${a.clientId}\`)\n` +
            `  Status: ${a.connectionStatus} | Capabilities: ${a.capabilities.join(', ') || 'none'}`
          );
        };

        const sections = [
          `## Agents (${agents.length} total)`,
          '',
        ];

        if (connected.length > 0) {
          sections.push(
            `### Online (${connected.length})`,
            '',
            ...connected.map(formatAgent),
            ''
          );
        }

        if (offline.length > 0) {
          sections.push(
            `### Offline (${offline.length})`,
            '',
            ...offline.map(formatAgent)
          );
        }

        return {
          content: [
            {
              type: 'text',
              text: sections.join('\n'),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching agents: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // =========================================================================
  // list_projects
  // =========================================================================
  server.tool(
    'list_projects',
    'List all projects with their @tags for task routing.',
    {
      groupId: z.string().optional().describe('Optional: Filter by group ID'),
    },
    async ({ groupId }) => {
      try {
        const projects = await nexus.getProjects(groupId);

        if (projects.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: groupId
                  ? 'No projects found in this group.'
                  : 'No projects found in the system.',
              },
            ],
          };
        }

        const active = projects.filter((p) => p.isActive);
        const archived = projects.filter((p) => !p.isActive);

        const formatProject = (p: typeof projects[0]) => {
          const tag = p.oblivionTag ? `@${p.oblivionTag}` : 'no tag';
          return (
            `- **${p.name}** (${tag})\n` +
            `  Group: ${p.group?.name || 'Unknown'} | Slack: ${p.slackChannelName || 'none'}`
          );
        };

        const sections = [
          `## Projects (${projects.length} total)`,
          '',
        ];

        if (active.length > 0) {
          sections.push(
            `### Active (${active.length})`,
            '',
            ...active.map(formatProject),
            ''
          );
        }

        if (archived.length > 0) {
          sections.push(
            `### Archived (${archived.length})`,
            '',
            ...archived.map(formatProject)
          );
        }

        return {
          content: [
            {
              type: 'text',
              text: sections.join('\n'),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching projects: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // =========================================================================
  // get_dashboard_stats
  // =========================================================================
  server.tool(
    'get_dashboard_stats',
    'Get overview statistics of the Oblivion system.',
    {},
    async () => {
      try {
        const stats = await nexus.getStats();

        return {
          content: [
            {
              type: 'text',
              text:
                `## Oblivion Dashboard\n\n` +
                `### Agents\n` +
                `- Connected: **${stats.connectedAgents}** / ${stats.totalAgents}\n\n` +
                `### Tasks\n` +
                `- Active (in progress): **${stats.activeTasks}**\n` +
                `- Pending (available): **${stats.pendingTasks}**\n\n` +
                `### Organization\n` +
                `- Groups: **${stats.totalGroups}**\n` +
                `- Projects: **${stats.totalProjects}**`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching dashboard stats: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // =========================================================================
  // get_all_tasks
  // =========================================================================
  server.tool(
    'get_all_tasks',
    'Get all tasks in the system grouped by status (for overview purposes).',
    {},
    async () => {
      try {
        const tasks = await nexus.getAllTasks();

        const formatTask = (t: { id: string; title: string; priority: number; project?: { name: string } }) =>
          `- [P${t.priority}] ${t.title} (${t.project?.name || 'Unknown'})`;

        const sections = [
          `## All Tasks`,
          '',
          `### TODO (${tasks.todo.length})`,
          tasks.todo.length > 0 ? tasks.todo.slice(0, 10).map(formatTask).join('\n') : '(none)',
          tasks.todo.length > 10 ? `... and ${tasks.todo.length - 10} more` : '',
          '',
          `### Claimed (${tasks.claimed.length})`,
          tasks.claimed.length > 0 ? tasks.claimed.slice(0, 10).map(formatTask).join('\n') : '(none)',
          tasks.claimed.length > 10 ? `... and ${tasks.claimed.length - 10} more` : '',
          '',
          `### In Progress (${tasks.inProgress.length})`,
          tasks.inProgress.length > 0 ? tasks.inProgress.slice(0, 10).map(formatTask).join('\n') : '(none)',
          tasks.inProgress.length > 10 ? `... and ${tasks.inProgress.length - 10} more` : '',
          '',
          `### Done (${tasks.done.length})`,
          tasks.done.length > 0 ? tasks.done.slice(0, 5).map(formatTask).join('\n') : '(none)',
          tasks.done.length > 5 ? `... and ${tasks.done.length - 5} more` : '',
        ];

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
              text: `Error fetching all tasks: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Get emoji for connection status
 */
function getStatusEmoji(status: string): string {
  switch (status) {
    case 'idle':
      return '🟢';
    case 'working':
      return '🔵';
    case 'connected':
      return '🟢';
    case 'error':
      return '🔴';
    case 'offline':
      return '⚫';
    default:
      return '⚪';
  }
}
