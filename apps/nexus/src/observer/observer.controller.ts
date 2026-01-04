import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ObserverService } from './observer.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Observer Controller.
 *
 * REST API for the Observer dashboard.
 *
 * Endpoints:
 * - GET /observer/stats      Dashboard statistics
 * - GET /observer/agents     All agents with connection status
 * - GET /observer/activity   Recent activity events
 * - GET /observer/tasks      Task queue grouped by status
 */
@Controller('observer')
@UseGuards(JwtAuthGuard)
export class ObserverController {
  constructor(private readonly observerService: ObserverService) {}

  /**
   * Get dashboard statistics.
   *
   * Returns counts of:
   * - Connected agents (from Redis)
   * - Total agents
   * - Active tasks (claimed or in progress)
   * - Pending tasks (todo)
   * - Total groups
   * - Total projects
   */
  @Get('stats')
  async getStats(@Request() req) {
    return this.observerService.getStats(req.user.tenantId);
  }

  /**
   * Get all agents with their real-time connection status.
   *
   * Each agent includes:
   * - Database fields (id, name, capabilities, etc.)
   * - isConnected: boolean from Redis
   * - connectionStatus: 'connected' | 'idle' | 'working' | 'error' | 'offline'
   * - connectedAt: timestamp if connected
   */
  @Get('agents')
  async getAgents(@Request() req) {
    return this.observerService.getAgents(req.user.tenantId);
  }

  /**
   * Get recent activity events.
   *
   * Returns events like:
   * - task_created
   * - task_claimed
   * - agent_connected
   * - agent_disconnected
   * - status_change
   */
  @Get('activity')
  async getActivity(
    @Request() req,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.observerService.getActivity(req.user.tenantId, limitNum);
  }

  /**
   * Get task queue grouped by status.
   *
   * Returns:
   * - todo: Tasks available for claiming
   * - claimed: Tasks claimed but not started
   * - inProgress: Tasks currently being worked on
   * - completed: Recently completed tasks
   */
  @Get('tasks')
  async getTaskQueue(@Request() req) {
    return this.observerService.getTaskQueue(req.user.tenantId);
  }
}
