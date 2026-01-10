/**
 * Oblivion MCP Server
 *
 * Exposes Nexus task management capabilities as MCP tools for Claude Code.
 *
 * Modes:
 * - Full mode: All tools available (requires NEXUS_URL, NEXUS_CLIENT_ID, NEXUS_CLIENT_SECRET)
 * - Bootstrap mode: Only registration tools (requires only NEXUS_URL)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createNexusClientFromEnv,
  createBootstrapClient,
  isBootstrapMode,
  type NexusClient,
} from './nexus-client.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerAgentTools } from './tools/agents.js';
import { registerSlackTools } from './tools/slack.js';
import { registerRegistrationTools } from './tools/registration.js';

export { isBootstrapMode };

/**
 * Create and configure the MCP server
 *
 * In bootstrap mode (no credentials), only registration tools are available.
 * This allows new agents to self-register before they have credentials.
 */
export function createServer(nexus?: NexusClient): McpServer {
  const bootstrapMode = !nexus && isBootstrapMode();

  const server = new McpServer({
    name: 'oblivion',
    version: '0.1.0',
  });

  // Use provided client, or create appropriate client based on mode
  const nexusClient = nexus ?? (bootstrapMode ? createBootstrapClient() : createNexusClientFromEnv());

  if (bootstrapMode) {
    // Bootstrap mode: only registration tools
    registerRegistrationTools(server, nexusClient);
  } else {
    // Full mode: all tools
    registerTaskTools(server, nexusClient);
    registerAgentTools(server, nexusClient);
    registerSlackTools(server, nexusClient);
    registerRegistrationTools(server, nexusClient);
  }

  return server;
}
