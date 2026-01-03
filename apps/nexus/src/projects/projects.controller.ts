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
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Projects Controller.
 *
 * REST API for managing Work Scopes (Projects).
 *
 * Endpoints:
 * - POST   /projects              Create a new project under a group
 * - GET    /projects              List all projects (filterable by group)
 * - GET    /projects/:id          Get project details with tasks
 * - GET    /projects/:id/stats    Get task statistics for project
 * - PATCH  /projects/:id          Update project (including oblivionTag)
 * - DELETE /projects/:id          Archive project
 */
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * Create a new project under a group.
   * Auto-creates a Slack channel for the project.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(req.user.tenantId, dto);
  }

  /**
   * List all projects for the tenant.
   * Can be filtered by group.
   */
  @Get()
  async findAll(
    @Request() req,
    @Query('groupId') groupId?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.projectsService.findAll(
      req.user.tenantId,
      groupId,
      includeInactive === 'true',
    );
  }

  /**
   * Get a single project with tasks.
   */
  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.projectsService.findOne(req.user.tenantId, id);
  }

  /**
   * Get task statistics for a project.
   */
  @Get(':id/stats')
  async getTaskStats(@Request() req, @Param('id') id: string) {
    return this.projectsService.getTaskStats(req.user.tenantId, id);
  }

  /**
   * Update a project.
   * Can update name, description, oblivionTag, and isActive.
   */
  @Patch(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(req.user.tenantId, id, dto);
  }

  /**
   * Archive a project (soft delete).
   * This also archives the associated Slack channel.
   */
  @Delete(':id')
  async archive(@Request() req, @Param('id') id: string) {
    return this.projectsService.archive(req.user.tenantId, id);
  }
}
