import { Module } from '@nestjs/common';
import { ObserverController } from './observer.controller';
import { ObserverService } from './observer.service';
import { GatewayModule } from '../gateway/gateway.module';

/**
 * Observer Module.
 *
 * Provides aggregated data for the Observer dashboard application.
 *
 * Features:
 * - Dashboard statistics (connected agents, tasks, groups, projects)
 * - Agent listing with real-time connection status
 * - Activity feed from recent events
 * - Task queue visualization
 *
 * Authentication:
 * Uses existing JWT auth - Observer dashboard authenticates as a special
 * "Observer Agent" with capabilities: ['observe', 'admin']
 */
@Module({
  imports: [GatewayModule], // For RedisService access
  controllers: [ObserverController],
  providers: [ObserverService],
  exports: [ObserverService],
})
export class ObserverModule {}
