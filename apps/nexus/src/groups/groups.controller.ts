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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { CreateGroupDto, UpdateGroupDto, AddMemberDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { getAuthUser } from '../auth/types/authenticated-request';

/**
 * Groups Controller - REST API for managing Agent Teams (Groups).
 */
@ApiTags('Groups')
@ApiBearerAuth('JWT')
@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a group',
    description:
      'Create a new agent group. Auto-creates a Slack channel (#oblivion-group-{slug}).',
  })
  @ApiBody({ type: CreateGroupDto })
  @ApiResponse({ status: 201, description: 'Group created successfully' })
  async create(@Request() req, @Body() dto: CreateGroupDto) {
    const user = getAuthUser(req);
    return this.groupsService.create(user.tenantId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List groups',
    description: 'Get all groups for the current tenant.',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Include archived groups',
  })
  @ApiResponse({ status: 200, description: 'List of groups' })
  async findAll(
    @Request() req,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const user = getAuthUser(req);
    return this.groupsService.findAll(
      user.tenantId,
      includeInactive === 'true',
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get group details',
    description: 'Get a group with its members and projects.',
  })
  @ApiParam({ name: 'id', description: 'Group ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Group details' })
  async findOne(@Request() req, @Param('id') id: string) {
    const user = getAuthUser(req);
    return this.groupsService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update group',
    description: 'Update group name, description, or status.',
  })
  @ApiParam({ name: 'id', description: 'Group ID (UUID)' })
  @ApiBody({ type: UpdateGroupDto })
  @ApiResponse({ status: 200, description: 'Group updated' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    const user = getAuthUser(req);
    return this.groupsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Archive group',
    description: 'Soft delete a group. Also archives the Slack channel.',
  })
  @ApiParam({ name: 'id', description: 'Group ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Group archived' })
  async archive(@Request() req, @Param('id') id: string) {
    const user = getAuthUser(req);
    return this.groupsService.archive(user.tenantId, id);
  }

  // =========================================================================
  // MEMBER MANAGEMENT
  // =========================================================================

  @Get(':id/members')
  @ApiOperation({
    summary: 'List group members',
    description: 'Get all agents that belong to this group.',
  })
  @ApiParam({ name: 'id', description: 'Group ID (UUID)' })
  @ApiResponse({ status: 200, description: 'List of members' })
  async getMembers(@Request() req, @Param('id') id: string) {
    const user = getAuthUser(req);
    return this.groupsService.getMembers(user.tenantId, id);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add member to group',
    description: 'Add an agent to the group. Also adds to Slack channel.',
  })
  @ApiParam({ name: 'id', description: 'Group ID (UUID)' })
  @ApiBody({ type: AddMemberDto })
  @ApiResponse({ status: 201, description: 'Member added' })
  async addMember(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    const user = getAuthUser(req);
    return this.groupsService.addMember(user.tenantId, id, dto);
  }

  @Delete(':id/members/:agentId')
  @ApiOperation({
    summary: 'Remove member from group',
    description:
      'Remove an agent from the group. Also removes from Slack channel.',
  })
  @ApiParam({ name: 'id', description: 'Group ID (UUID)' })
  @ApiParam({ name: 'agentId', description: 'Agent ID to remove' })
  @ApiResponse({ status: 200, description: 'Member removed' })
  async removeMember(
    @Request() req,
    @Param('id') id: string,
    @Param('agentId') agentId: string,
  ) {
    const user = getAuthUser(req);
    return this.groupsService.removeMember(user.tenantId, id, agentId);
  }
}
