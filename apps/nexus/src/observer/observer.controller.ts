import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ObserverService } from './observer.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateAgentDto, UpdateAgentDto, CreateRegistrationTokenDto, RejectAgentDto } from './dto';

/**
 * Observer Controller.
 *
 * REST API for the Observer dashboard.
 *
 * Endpoints:
 * - GET /observer/stats         Dashboard statistics
 * - GET /observer/agents        All agents with connection status
 * - GET /observer/agents/:id    Single agent details
 * - PATCH /observer/agents/:id  Update agent profile
 * - GET /observer/activity      Recent activity events
 * - GET /observer/tasks         Task queue grouped by status
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
   * Create a new agent.
   *
   * Required fields: name, clientId, clientSecret
   * Optional fields: description, capabilities
   */
  @Post('agents')
  async createAgent(@Request() req, @Body() dto: CreateAgentDto) {
    return this.observerService.createAgent(req.user.tenantId, dto);
  }

  // =========================================================================
  // AGENT APPROVAL WORKFLOW - Must come BEFORE agents/:id to avoid route conflicts
  // =========================================================================

  /**
   * Get all agents pending approval.
   *
   * Returns agents with approvalStatus: 'PENDING',
   * including their pending group information.
   */
  @Get('agents/pending')
  async getPendingAgents(@Request() req) {
    return this.observerService.getPendingAgents(req.user.tenantId);
  }

  /**
   * Get count of pending agents (for badge display).
   */
  @Get('agents/pending/count')
  async getPendingCount(@Request() req) {
    return this.observerService.getPendingCount(req.user.tenantId);
  }

  /**
   * Approve a pending agent registration.
   *
   * This will:
   * - Set approvalStatus to APPROVED
   * - Add agent to pending group as 'member'
   * - Invite to group's Slack channel (if configured)
   */
  @Post('agents/:id/approve')
  async approveAgent(@Request() req, @Param('id') agentId: string) {
    return this.observerService.approveAgent(
      req.user.tenantId,
      agentId,
      req.user.id,
    );
  }

  /**
   * Reject a pending agent registration.
   *
   * Optional body: { reason?: string }
   */
  @Post('agents/:id/reject')
  async rejectAgent(
    @Request() req,
    @Param('id') agentId: string,
    @Body() dto: RejectAgentDto,
  ) {
    return this.observerService.rejectAgent(
      req.user.tenantId,
      agentId,
      req.user.id,
      dto,
    );
  }

  /**
   * Get a single agent by ID with full details.
   */
  @Get('agents/:id')
  async getAgent(@Request() req, @Param('id') agentId: string) {
    return this.observerService.getAgent(req.user.tenantId, agentId);
  }

  /**
   * Update an agent's profile.
   *
   * Updatable fields:
   * - name, description, email, avatarUrl, slackUserId, capabilities
   */
  @Patch('agents/:id')
  async updateAgent(
    @Request() req,
    @Param('id') agentId: string,
    @Body() dto: UpdateAgentDto,
  ) {
    return this.observerService.updateAgent(req.user.tenantId, agentId, dto);
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

  // =========================================================================
  // REGISTRATION TOKEN MANAGEMENT
  // =========================================================================

  /**
   * Create a registration token for a group.
   *
   * Required: groupId
   * Optional: name, expiresInHours, maxUses
   */
  @Post('registration-tokens')
  async createRegistrationToken(
    @Request() req,
    @Body() dto: CreateRegistrationTokenDto,
  ) {
    return this.observerService.createRegistrationToken(
      req.user.tenantId,
      req.user.id, // creator agent ID
      dto,
    );
  }

  /**
   * List registration tokens.
   *
   * Optional query param: groupId to filter by group
   */
  @Get('registration-tokens')
  async listRegistrationTokens(
    @Request() req,
    @Query('groupId') groupId?: string,
  ) {
    return this.observerService.listRegistrationTokens(req.user.tenantId, groupId);
  }

  /**
   * Revoke (deactivate) a registration token.
   */
  @Delete('registration-tokens/:id')
  async revokeRegistrationToken(
    @Request() req,
    @Param('id') tokenId: string,
  ) {
    return this.observerService.revokeRegistrationToken(req.user.tenantId, tokenId);
  }
}
