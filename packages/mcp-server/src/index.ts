#!/usr/bin/env node
/**
 * Oblivion MCP Server Entry Point
 *
 * This server connects Claude Code to the Oblivion/Nexus task management system.
 *
 * Environment Variables:
 *   NEXUS_URL           - Base URL of the Nexus server (e.g., http://localhost:3000)
 *   NEXUS_CLIENT_ID     - Agent client ID for authentication (optional for bootstrap)
 *   NEXUS_CLIENT_SECRET - Agent client secret for authentication (optional for bootstrap)
 *
 * Modes:
 *   Full Mode:      All env vars set - full functionality
 *   Bootstrap Mode: Only NEXUS_URL set - registration tools only
 *
 * Usage:
 *   node dist/index.js
 *
 * Or configure in Claude Code's MCP settings.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer, isBootstrapMode } from './server.js';
import { getEffectiveCredentials, listProfiles } from './credentials-manager.js';
import { releaseProfileLock, getAllLocks } from './profile-lock-manager.js';

async function main(): Promise<void> {
  // Load credentials and profiles (async operations)
  const creds = await getEffectiveCredentials();
  const bootstrapMode = isBootstrapMode(creds);
  const profiles = await listProfiles();
  const allLocks = await getAllLocks();

  // Register cleanup handlers to release profile lock on exit
  const cleanup = () => {
    // Note: Using promise without await in cleanup handler
    // This is intentional as cleanup handlers need to be synchronous-ish
    releaseProfileLock(process.pid).catch(() => {
      // Ignore errors during cleanup
    });
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  // Create the MCP server (async)
  const server = await createServer();

  // Create stdio transport for Claude Code communication
  const transport = new StdioServerTransport();

  // Connect server to transport
  await server.connect(transport);

  // Log startup (goes to stderr so it doesn't interfere with MCP protocol on stdout)
  console.error('Oblivion MCP Server started');
  console.error(`  NEXUS_URL: ${creds.nexusUrl || '(not set)'}`);
  console.error(`  PID: ${process.pid}`);

  if (creds.clientId) {
    console.error(`  Profile: ${creds.selectedProfile || creds.clientId} (${creds.selectionMethod || 'loaded'})`);
    console.error(`  Agent: ${creds.clientId}`);
  }

  if (process.env.OBLIVION_PROFILE) {
    console.error(`  OBLIVION_PROFILE: ${process.env.OBLIVION_PROFILE} (override)`);
  }

  if (profiles.length > 1) {
    console.error(`  Available profiles: ${profiles.length} total`);
    if (allLocks.length > 0) {
      console.error(`  Active locks: ${allLocks.length} (PIDs: ${allLocks.map(l => l.pid).join(', ')})`);
    }
  }

  if (bootstrapMode) {
    console.error('');
    if (creds.selectionMethod === 'all_locked') {
      console.error('  ⚠️  All agent profiles are currently in use by other Claude instances.');
      console.error(`     Locked profiles: ${allLocks.map(l => `${l.profile} (PID ${l.pid})`).join(', ')}`);
      console.error('');
      console.error('  Options:');
      console.error('  1. Register a new agent with register_agent');
      console.error('  2. Stop a running Claude instance to free a profile');
      console.error('  3. Set OBLIVION_PROFILE to explicitly use a profile (shares identity)');
    } else {
      console.error('  ⚠️  No credentials configured - only registration tools will work.');
      console.error('  Use register_agent to self-register and credentials will be saved automatically.');
    }
  }
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
