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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { UpdateTaskStatusDto, PostSlackReplyDto, GetSlackThreadDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Tasks Controller - REST API for task operations.
 */
@ApiTags('Tasks')
@ApiBearerAuth('JWT')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('available')
  @ApiOperation({
    summary: 'List available tasks',
    description:
      'Get all unclaimed tasks available for the current agent. ' +
      'Only returns tasks from groups the agent belongs to.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of available tasks',
  })
  async getAvailableTasks(@Request() req) {
    return this.tasksService.getAvailableTasks(req.user.id);
  }

  @Get('claimed')
  @ApiOperation({
    summary: 'List claimed tasks',
    description: 'Get all tasks currently claimed by the authenticated agent.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of claimed tasks',
  })
  async getClaimedTasks(@Request() req) {
    return this.tasksService.getClaimedTasks(req.user.id);
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Claim a task',
    description:
      'Claim an available task. The task must be unclaimed and the agent ' +
      'must belong to the task\'s group. Also available via WebSocket.',
  })
  @ApiParam({ name: 'id', description: 'Task ID (internal UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Task claimed successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Task not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Task already claimed',
  })
  async claimTask(@Request() req, @Param('id') taskId: string) {
    return this.tasksService.claimTask(req.user.id, taskId);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update task status',
    description:
      'Update the status of a claimed task. Valid statuses: ' +
      'IN_PROGRESS, BLOCKED_ON_HUMAN, DONE.',
  })
  @ApiParam({ name: 'id', description: 'Task ID (internal UUID)' })
  @ApiBody({ type: UpdateTaskStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Status updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Not authorized (task not claimed by this agent)',
  })
  async updateStatus(
    @Request() req,
    @Param('id') taskId: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.tasksService.updateTaskStatus(req.user.id, taskId, dto.status);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get task by ClickUp ID',
    description: 'Get task details using the external ClickUp task ID.',
  })
  @ApiParam({ name: 'id', description: 'ClickUp task ID' })
  @ApiResponse({
    status: 200,
    description: 'Task details',
  })
  async getTask(@Param('id') taskId: string) {
    return this.tasksService.findByClickupId(taskId);
  }

  @Get('by-id/:id')
  @ApiOperation({
    summary: 'Get task by internal ID',
    description: 'Get task details using the internal Oblivion task ID.',
  })
  @ApiParam({ name: 'id', description: 'Internal task ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Task details',
  })
  async getTaskById(@Param('id') taskId: string) {
    return this.tasksService.findById(taskId);
  }

  @Post(':id/slack-reply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Post to Slack thread',
    description:
      'Post a message to the task\'s Slack thread. ' +
      'Only the agent who claimed the task can post.',
  })
  @ApiParam({ name: 'id', description: 'Task ID (internal UUID)' })
  @ApiBody({ type: PostSlackReplyDto })
  @ApiResponse({
    status: 200,
    description: 'Message posted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Not authorized (task not claimed by this agent)',
  })
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

  @Get(':id/slack-thread')
  @ApiOperation({
    summary: 'Get Slack thread messages',
    description:
      'Get messages from the task\'s Slack thread. ' +
      'Any agent in the task\'s group can read the thread.',
  })
  @ApiParam({ name: 'id', description: 'Task ID (internal UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Thread messages with pagination',
  })
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
