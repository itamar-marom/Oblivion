/**
 * Oblivion MCP Server
 *
 * Exposes Nexus task management capabilities as MCP tools for Claude Code.
 *
 * All tools are always available. Registration tools work without credentials.
 * Task/agent/slack tools will fail gracefully if credentials are missing.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createNexusClientFromEnv,
  createBootstrapClient,
  type NexusClient,
} from './nexus-client.js';
import { getEffectiveCredentials } from './credentials-manager.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerAgentTools } from './tools/agents.js';
import { registerSlackTools } from './tools/slack.js';
import { registerRegistrationTools } from './tools/registration.js';
import { registerHealthTools } from './tools/health.js';

/**
 * Effective credentials type returned by getEffectiveCredentials
 */
export interface EffectiveCreds {
  nexusUrl?: string;
  clientId?: string;
  clientSecret?: string;
  selectedProfile?: string;
  selectionMethod?: string;
}

/**
 * Check if we're in bootstrap mode by checking credentials
 */
export function isBootstrapMode(creds: EffectiveCreds): boolean {
  return !!creds.nexusUrl && (!creds.clientId || !creds.clientSecret);
}

/**
 * Create and configure the MCP server
 *
 * All tools are always registered. No need to switch modes - one config works
 * for both bootstrap (registration only) and full operation.
 */
export async function createServer(nexus?: NexusClient): Promise<McpServer> {
  const server = new McpServer({
    name: 'oblivion',
    version: '0.1.0',
  });

  let nexusClient: NexusClient;

  if (nexus) {
    // Use provided client (for testing)
    nexusClient = nexus;
  } else {
    // Load credentials and set env vars for nexus-client to use
    const creds = await getEffectiveCredentials();

    if (creds.nexusUrl) process.env.NEXUS_URL = creds.nexusUrl;
    if (creds.clientId) process.env.NEXUS_CLIENT_ID = creds.clientId;
    if (creds.clientSecret) process.env.NEXUS_CLIENT_SECRET = creds.clientSecret;

    const bootstrapMode = isBootstrapMode(creds);
    nexusClient = bootstrapMode ? createBootstrapClient() : createNexusClientFromEnv();
  }

  // Always register all tools - no mode switching needed
  registerTaskTools(server, nexusClient);
  registerAgentTools(server, nexusClient);
  registerSlackTools(server, nexusClient);
  registerRegistrationTools(server, nexusClient);
  registerHealthTools(server, nexusClient);

  return server;
}
