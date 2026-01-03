import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { GatewayModule } from '../gateway/gateway.module';

/**
 * Tasks Module.
 *
 * Handles task lifecycle including:
 * - Task claiming by agents
 * - Broadcasting availability to group members
 * - Status updates
 *
 * WebSocket Events:
 * - TASK_AVAILABLE: Broadcast when new task is created
 * - CLAIM_TASK: Agent requests to claim a task
 * - TASK_CLAIMED: Notify others when task is claimed
 */
@Module({
  imports: [GatewayModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
