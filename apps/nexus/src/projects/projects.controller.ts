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
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { getAuthUser } from '../auth/types/authenticated-request';

/**
 * Projects Controller - REST API for managing Work Scopes (Projects).
 */
@ApiTags('Projects')
@ApiBearerAuth('JWT')
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a project',
    description:
      'Create a new project under a group. Auto-creates a Slack channel. ' +
      'The @tag is used for routing tasks from ClickUp.',
  })
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({ status: 201, description: 'Project created' })
  async create(@Request() req, @Body() dto: CreateProjectDto) {
    const user = getAuthUser(req);
    return this.projectsService.create(user.tenantId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List projects',
    description: 'Get all projects. Optionally filter by group.',
  })
  @ApiQuery({
    name: 'groupId',
    required: false,
    description: 'Filter by group ID',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Include archived projects',
  })
  @ApiResponse({ status: 200, description: 'List of projects' })
  async findAll(
    @Request() req,
    @Query('groupId') groupId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const user = getAuthUser(req);
    return this.projectsService.findAll(
      user.tenantId,
      groupId,
      includeInactive === 'true',
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get project details',
    description: 'Get a project with its tasks.',
  })
  @ApiParam({ name: 'id', description: 'Project ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Project details' })
  async findOne(@Request() req, @Param('id') id: string) {
    const user = getAuthUser(req);
    return this.projectsService.findOne(user.tenantId, id);
  }

  @Get(':id/stats')
  @ApiOperation({
    summary: 'Get project stats',
    description: 'Get task statistics for a project (counts by status).',
  })
  @ApiParam({ name: 'id', description: 'Project ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Task statistics' })
  async getTaskStats(@Request() req, @Param('id') id: string) {
    const user = getAuthUser(req);
    return this.projectsService.getTaskStats(user.tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update project',
    description: 'Update project name, description, @tag, or status.',
  })
  @ApiParam({ name: 'id', description: 'Project ID (UUID)' })
  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({ status: 200, description: 'Project updated' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    const user = getAuthUser(req);
    return this.projectsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Archive project',
    description: 'Soft delete a project. Also archives the Slack channel.',
  })
  @ApiParam({ name: 'id', description: 'Project ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Project archived' })
  async archive(@Request() req, @Param('id') id: string) {
    const user = getAuthUser(req);
    return this.projectsService.archive(user.tenantId, id);
  }
}
