import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto, UpdateGroupDto, AddMemberDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Groups Controller.
 *
 * REST API for managing Agent Teams (Groups).
 *
 * Endpoints:
 * - POST   /groups              Create a new group
 * - GET    /groups              List all groups
 * - GET    /groups/:id          Get group details with members and projects
 * - PATCH  /groups/:id          Update group
 * - DELETE /groups/:id          Archive group
 * - GET    /groups/:id/members  List group members
 * - POST   /groups/:id/members  Add agent to group
 * - DELETE /groups/:id/members/:agentId  Remove agent from group
 */
@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  /**
   * Create a new group.
   * Auto-creates a Slack channel for the group.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(req.user.tenantId, dto);
  }

  /**
   * List all groups for the tenant.
   */
  @Get()
  async findAll(
    @Request() req,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.groupsService.findAll(
      req.user.tenantId,
      includeInactive === 'true',
    );
  }

  /**
   * Get a single group with members and projects.
   */
  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.groupsService.findOne(req.user.tenantId, id);
  }

  /**
   * Update a group.
   */
  @Patch(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.update(req.user.tenantId, id, dto);
  }

  /**
   * Archive a group (soft delete).
   * This also archives the associated Slack channel.
   */
  @Delete(':id')
  async archive(@Request() req, @Param('id') id: string) {
    return this.groupsService.archive(req.user.tenantId, id);
  }

  // =========================================================================
  // MEMBER MANAGEMENT
  // =========================================================================

  /**
   * List all members of a group.
   */
  @Get(':id/members')
  async getMembers(@Request() req, @Param('id') id: string) {
    return this.groupsService.getMembers(req.user.tenantId, id);
  }

  /**
   * Add an agent to a group.
   * This also adds the agent to the group's Slack channel.
   */
  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  async addMember(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.groupsService.addMember(req.user.tenantId, id, dto);
  }

  /**
   * Remove an agent from a group.
   * This also removes the agent from the group's Slack channel.
   */
  @Delete(':id/members/:agentId')
  async removeMember(
    @Request() req,
    @Param('id') id: string,
    @Param('agentId') agentId: string,
  ) {
    return this.groupsService.removeMember(req.user.tenantId, id, agentId);
  }
}
