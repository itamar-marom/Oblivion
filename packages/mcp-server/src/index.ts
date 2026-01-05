#!/usr/bin/env node
/**
 * Oblivion MCP Server Entry Point
 *
 * This server connects Claude Code to the Oblivion/Nexus task management system.
 *
 * Environment Variables:
 *   NEXUS_URL         - Base URL of the Nexus server (e.g., http://localhost:3000)
 *   NEXUS_CLIENT_ID   - Agent client ID for authentication
 *   NEXUS_CLIENT_SECRET - Agent client secret for authentication
 *
 * Usage:
 *   node dist/index.js
 *
 * Or configure in Claude Code's MCP settings.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

async function main(): Promise<void> {
  // Create the MCP server
  const server = createServer();

  // Create stdio transport for Claude Code communication
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  // Log startup (goes to stderr so it doesn't interfere with MCP protocol on stdout)
  console.error('Oblivion MCP Server started');
  console.error(`  NEXUS_URL: ${process.env.NEXUS_URL || '(not set)'}`);
  console.error(`  NEXUS_CLIENT_ID: ${process.env.NEXUS_CLIENT_ID || '(not set)'}`);
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
