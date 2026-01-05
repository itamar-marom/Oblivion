/**
 * Oblivion MCP Server
 *
 * Exposes Nexus task management capabilities as MCP tools for Claude Code.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createNexusClientFromEnv, type NexusClient } from './nexus-client.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerAgentTools } from './tools/agents.js';
import { registerSlackTools } from './tools/slack.js';

/**
 * Create and configure the MCP server
 */
export function createServer(nexus?: NexusClient): McpServer {
  const server = new McpServer({
    name: 'oblivion',
    version: '0.1.0',
  });

  // Use provided client or create from environment
  const nexusClient = nexus ?? createNexusClientFromEnv();

  // Register all tools
  registerTaskTools(server, nexusClient);
  registerAgentTools(server, nexusClient);
  registerSlackTools(server, nexusClient);

  return server;
}
