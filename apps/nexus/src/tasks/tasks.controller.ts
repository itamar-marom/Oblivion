import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { UpdateTaskStatusDto, PostSlackReplyDto, GetSlackThreadDto } from './dto';
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

  /**
   * Get a specific task by internal ID.
   */
  @Get('by-id/:id')
  async getTaskById(@Param('id') taskId: string) {
    return this.tasksService.findById(taskId);
  }

  /**
   * Post a message to a task's Slack thread.
   * Only the agent who claimed the task can post to its thread.
   */
  @Post(':id/slack-reply')
  @HttpCode(HttpStatus.OK)
  async postSlackReply(
    @Request() req,
    @Param('id') taskId: string,
    @Body() dto: PostSlackReplyDto,
  ) {
    return this.tasksService.postToSlackThread(
      req.user.id,
      taskId,
      dto.message,
      dto.broadcast,
    );
  }

  /**
   * Get Slack thread messages for a task.
   * Any agent in the task's group can read the thread.
   */
  @Get(':id/slack-thread')
  async getSlackThread(
    @Request() req,
    @Param('id') taskId: string,
    @Query() dto: GetSlackThreadDto,
  ) {
    return this.tasksService.getTaskSlackThread(
      req.user.id,
      taskId,
      dto.limit || 15,
      dto.cursor,
    );
  }
}
