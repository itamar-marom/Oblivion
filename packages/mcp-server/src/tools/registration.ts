/**
 * Agent Registration Tools
 *
 * MCP tools for self-service agent registration with Nexus.
 * Automatically saves credentials after successful registration.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { NexusClient } from '../nexus-client.js';
import { saveCredentials, clearCredentials, listProfiles } from '../credentials-manager.js';

/**
 * Register registration-related tools with the MCP server
 */
export function registerRegistrationTools(server: McpServer, nexus: NexusClient): void {
  // =========================================================================
  // register_agent
  // =========================================================================
  server.tool(
    'register_agent',
    'Register a new agent with Nexus using a registration token. ' +
      'Obtain a registration token from an admin via the Observer dashboard. ' +
      'After registration, the agent will be in PENDING status until approved by an admin.',
    {
      registrationToken: z
        .string()
        .min(4)
        .describe('Registration token provided by an admin (starts with "reg_")'),
      name: z
        .string()
        .min(2)
        .max(100)
        .describe('Display name for the agent (e.g., "Code Reviewer Bot")'),
      clientId: z
        .string()
        .min(2)
        .max(50)
        .regex(/^[a-z0-9-]+$/)
        .describe('Unique client ID for authentication (lowercase alphanumeric with hyphens, e.g., "code-reviewer")'),
      clientSecret: z
        .string()
        .min(8)
        .max(100)
        .describe('Secret for authentication (min 8 characters). Save this securely - it cannot be retrieved later.'),
      description: z
        .string()
        .max(500)
        .optional()
        .describe('Optional description of what this agent does'),
      email: z
        .string()
        .email()
        .optional()
        .describe('Optional contact email for the agent operator'),
      capabilities: z
        .array(z.string())
        .optional()
        .describe('Optional list of agent capabilities (e.g., ["code", "review", "test"])'),
    },
    async ({ registrationToken, name, clientId, clientSecret, description, email, capabilities }) => {
      try {
        const result = await nexus.registerAgent({
          registrationToken,
          name,
          clientId,
          clientSecret,
          description,
          email,
          capabilities,
        });

        // Save credentials to disk for future use
        // Get NEXUS_URL from env (required for MCP to be running)
        const nexusUrl = process.env.NEXUS_URL;
        if (nexusUrl) {
          saveCredentials({
            nexusUrl,
            clientId,
            clientSecret,
            agentId: result.id,
            agentName: result.name,
            savedAt: new Date().toISOString(),
          });
        }

        const sections = [
          '## Agent Registration Submitted',
          '',
          `**Status:** ${getStatusEmoji(result.approvalStatus)} ${result.approvalStatus}`,
          '',
          '### Agent Details',
          `- **ID:** \`${result.id}\``,
          `- **Client ID:** \`${result.clientId}\``,
          `- **Name:** ${result.name}`,
        ];

        if (result.pendingGroup) {
          sections.push(
            '',
            '### Target Group',
            `- **Name:** ${result.pendingGroup.name}`,
            `- **ID:** \`${result.pendingGroup.id}\``,
            '',
            'The agent will automatically join this group upon approval.'
          );
        }

        sections.push(
          '',
          '### Next Steps',
          '',
          result.message,
          '',
          '✅ **Credentials automatically saved!**',
          `- File: \`~/.oblivion/credentials.json\``,
          `- Profile: \`${result.clientId}\` (active)`,
          '',
          '**Multiple agents on same host?** No problem!',
          'Each agent registration creates a new profile. Switch between them using:',
          '```bash',
          `claude mcp update oblivion --env OBLIVION_PROFILE=${result.clientId}`,
          '```',
          '',
          '**After admin approval:**',
          '1. Use `check_registration_status` to verify approval',
          '2. Restart Claude Code (credentials auto-load)',
          '3. All tools work automatically - no config edits needed!',
          '',
          'Your credentials are securely stored (600 permissions, owner-only access).'
        );

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
              text: `## Registration Failed\n\n${error instanceof Error ? error.message : String(error)}\n\n` +
                'Common issues:\n' +
                '- Invalid or expired registration token\n' +
                '- Client ID already exists (try a different one)\n' +
                '- Client secret too short (minimum 8 characters)',
            },
          ],
          isError: true,
        };
      }
    }
  );

  // =========================================================================
  // check_registration_status
  // =========================================================================
  server.tool(
    'check_registration_status',
    'Check the approval status of a registered agent by attempting to authenticate. ' +
      'Returns whether the agent is PENDING, APPROVED, or REJECTED.',
    {
      clientId: z.string().describe('The client ID used during registration'),
      clientSecret: z.string().describe('The client secret used during registration'),
    },
    async ({ clientId, clientSecret }) => {
      try {
        const result = await nexus.checkAuthStatus(clientId, clientSecret);

        const statusMessage = {
          PENDING: 'Your registration is still pending admin approval. Please wait for an admin to review your request.',
          APPROVED: 'Your registration has been approved! You can now authenticate and use the Nexus APIs.',
          REJECTED: `Your registration was rejected.${result.rejectionReason ? ` Reason: ${result.rejectionReason}` : ''}`,
        }[result.approvalStatus];

        return {
          content: [
            {
              type: 'text',
              text: `## Registration Status\n\n` +
                `**Client ID:** \`${clientId}\`\n` +
                `**Status:** ${getStatusEmoji(result.approvalStatus)} ${result.approvalStatus}\n\n` +
                statusMessage,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `## Status Check Failed\n\n${error instanceof Error ? error.message : String(error)}\n\n` +
                'This may indicate:\n' +
                '- Invalid credentials\n' +
                '- Agent not found\n' +
                '- Agent has been deactivated',
            },
          ],
          isError: true,
        };
      }
    }
  );

  // =========================================================================
  // deregister_agent
  // =========================================================================
  server.tool(
    'deregister_agent',
    'Remove saved agent credentials from this machine. Use this to switch agents or clean up after testing. ' +
      'Does not delete the agent from Nexus - only removes local credentials.',
    {
      profile: z.string().optional().describe('Profile name to remove (defaults to current/active profile). Use "all" to remove all profiles.'),
    },
    async ({ profile }) => {
      try {
        const profiles = listProfiles();

        if (profiles.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: '## No Saved Credentials\n\n' +
                  'No agent profiles found in `~/.oblivion/credentials.json`.\n\n' +
                  'Use `register_agent` to create a new profile.',
              },
            ],
          };
        }

        if (profile === 'all') {
          // Clear all profiles
          clearCredentials();
          return {
            content: [
              {
                type: 'text',
                text: '## All Credentials Removed\n\n' +
                  `Removed ${profiles.length} profile(s) from \`~/.oblivion/credentials.json\`:\n` +
                  profiles.map(p => `- \`${p}\``).join('\n') + '\n\n' +
                  '**Next steps:**\n' +
                  '1. Use `register_agent` to register a new agent\n' +
                  '2. Or manually configure credentials via Claude Code MCP settings',
              },
            ],
          };
        }

        // Clear specific profile (or active if not specified)
        const success = clearCredentials(profile);

        if (success) {
          const remaining = listProfiles();
          return {
            content: [
              {
                type: 'text',
                text: `## Profile Removed\n\n` +
                  `Removed profile: \`${profile || 'active'}\`\n\n` +
                  (remaining.length > 0
                    ? `**Remaining profiles:**\n${remaining.map(p => `- \`${p}\``).join('\n')}\n\n` +
                      'Restart Claude Code to use a different profile.'
                    : '**No profiles remaining.**\n\nUse `register_agent` to create a new one.'),
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `## Profile Not Found\n\n` +
                  `Profile \`${profile}\` does not exist.\n\n` +
                  `**Available profiles:**\n${profiles.map(p => `- \`${p}\``).join('\n')}`,
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
              text: `## Deregister Failed\n\n${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Get emoji for approval status
 */
function getStatusEmoji(status: string): string {
  switch (status) {
    case 'PENDING':
      return '⏳';
    case 'APPROVED':
      return '✅';
    case 'REJECTED':
      return '❌';
    default:
      return '❓';
  }
}
