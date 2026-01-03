import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { UpdateTaskStatusDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Tasks Controller.
 *
 * REST API for task operations.
 * Note: Task claiming is handled via WebSocket (CLAIM_TASK event).
 *
 * Endpoints:
 * - GET    /tasks/available     Get available tasks for claiming
 * - GET    /tasks/claimed       Get tasks claimed by current agent
 * - POST   /tasks/:id/claim     Claim a task (REST alternative)
 * - PATCH  /tasks/:id/status    Update task status
 */
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /**
   * Get available tasks for the current agent.
   * Returns unclaimed tasks from all groups the agent belongs to.
   */
  @Get('available')
  async getAvailableTasks(@Request() req) {
    return this.tasksService.getAvailableTasks(req.user.id);
  }

  /**
   * Get tasks claimed by the current agent.
   */
  @Get('claimed')
  async getClaimedTasks(@Request() req) {
    return this.tasksService.getClaimedTasks(req.user.id);
  }

  /**
   * Claim a task (REST alternative to WebSocket CLAIM_TASK).
   */
  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  async claimTask(@Request() req, @Param('id') taskId: string) {
    return this.tasksService.claimTask(req.user.id, taskId);
  }

  /**
   * Update task status.
   */
  @Patch(':id/status')
  async updateStatus(
    @Request() req,
    @Param('id') taskId: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateTaskStatus(req.user.id, taskId, dto.status);
  }

  /**
   * Get a specific task by ID.
   */
  @Get(':id')
  async getTask(@Param('id') taskId: string) {
    return this.tasksService.findByClickupId(taskId);
  }
}
