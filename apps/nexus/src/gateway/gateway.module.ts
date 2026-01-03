import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AgentGateway } from './agent.gateway';
import { RedisService } from './redis.service';

/**
 * Gateway Module provides WebSocket infrastructure for agent communication.
 *
 * Features:
 * - WebSocket Gateway on /agents namespace
 * - JWT authentication for connections
 * - Redis-backed connection tracking (multi-pod support)
 * - Event types: TASK_AVAILABLE, TASK_CLAIMED, CONTEXT_UPDATE, WAKE_UP, TOOL_RESULT, HEARTBEAT
 *
 * Usage in other modules:
 *   constructor(private gateway: AgentGateway) {}
 *
 *   // Emit task available to specific agent
 *   await this.gateway.emitToAgent(agentId, createEvent(
 *     EventType.TASK_AVAILABLE,
 *     { taskId: '...', ... }
 *   ));
 *
 *   // Emit to all agents in a group
 *   await this.gateway.emitToGroup(groupId, event);
 */
@Module({
  imports: [
    // Share JWT config with auth module
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'fallback_secret',
    }),
  ],
  providers: [AgentGateway, RedisService],
  exports: [AgentGateway, RedisService],
})
export class GatewayModule {}
