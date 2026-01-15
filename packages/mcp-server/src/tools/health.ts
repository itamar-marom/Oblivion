/**
 * Health Check Tools
 *
 * Provides health monitoring capabilities for the MCP server.
 * Essential for orchestrators (Kubernetes, systemd) to detect failures.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { NexusClient } from '../nexus-client.js';
import { getAllLocks, cleanStaleLocks } from '../profile-lock-manager.js';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  pid: number;
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    latencyMs?: number;
  }[];
}

/**
 * Register health check tools
 */
export function registerHealthTools(server: McpServer, nexus: NexusClient): void {
  // =========================================================================
  // Health Check Tool
  // =========================================================================

  server.tool(
    'health_check',
    'Check MCP server health status, including connectivity to Nexus backend',
    {
      deep: z
        .boolean()
        .optional()
        .describe('Perform deep health check including Nexus connectivity (default: false)'),
    },
    async ({ deep = false }) => {
      const startTime = Date.now();
      const checks: HealthStatus['checks'] = [];

      // Basic checks
      checks.push({
        name: 'process',
        status: 'pass',
        message: `PID ${process.pid} running`,
      });

      // Memory check
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const heapPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

      checks.push({
        name: 'memory',
        status: heapPercent > 90 ? 'warn' : 'pass',
        message: `Heap: ${heapUsedMB}MB / ${heapTotalMB}MB (${heapPercent}%)`,
      });

      // Profile locks check
      try {
        const staleCleaned = await cleanStaleLocks();
        const currentLocks = await getAllLocks();
        checks.push({
          name: 'profile_locks',
          status: 'pass',
          message: `${currentLocks.length} active locks, ${staleCleaned.length} stale cleaned`,
        });
      } catch (error) {
        checks.push({
          name: 'profile_locks',
          status: 'fail',
          message: error instanceof Error ? error.message : String(error),
        });
      }

      // Deep check: Nexus connectivity
      if (deep) {
        const nexusStart = Date.now();
        try {
          await nexus.getStats();
          checks.push({
            name: 'nexus_connectivity',
            status: 'pass',
            message: 'Connected to Nexus backend',
            latencyMs: Date.now() - nexusStart,
          });
        } catch (error) {
          checks.push({
            name: 'nexus_connectivity',
            status: 'fail',
            message: error instanceof Error ? error.message : String(error),
            latencyMs: Date.now() - nexusStart,
          });
        }
      }

      // Calculate overall status
      const hasFailure = checks.some(c => c.status === 'fail');
      const hasWarning = checks.some(c => c.status === 'warn');

      const healthStatus: HealthStatus = {
        status: hasFailure ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        pid: process.pid,
        checks,
      };

      const totalLatencyMs = Date.now() - startTime;

      // Format output
      const statusEmoji =
        healthStatus.status === 'healthy' ? '✅' :
        healthStatus.status === 'degraded' ? '⚠️' : '❌';

      let output = `## ${statusEmoji} MCP Server Health: ${healthStatus.status.toUpperCase()}\n\n`;
      output += `- **PID:** ${healthStatus.pid}\n`;
      output += `- **Uptime:** ${Math.round(healthStatus.uptime)}s\n`;
      output += `- **Check Duration:** ${totalLatencyMs}ms\n`;
      output += `- **Timestamp:** ${healthStatus.timestamp}\n\n`;

      output += `### Checks\n\n`;
      for (const check of healthStatus.checks) {
        const emoji = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
        const latency = check.latencyMs ? ` (${check.latencyMs}ms)` : '';
        output += `- ${emoji} **${check.name}**: ${check.message}${latency}\n`;
      }

      return {
        content: [{ type: 'text' as const, text: output }],
      };
    }
  );
}
