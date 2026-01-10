import { Module } from '@nestjs/common';
import { ObserverController } from './observer.controller';
import { ObserverService } from './observer.service';
import { GatewayModule } from '../gateway/gateway.module';
import { IntegrationsModule } from '../integrations/integrations.module';

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
 * - Agent approval workflow
 * - Registration token management
 *
 * Authentication:
 * Uses existing JWT auth - Observer dashboard authenticates as a special
 * "Observer Agent" with capabilities: ['observe', 'admin']
 */
@Module({
  imports: [GatewayModule, IntegrationsModule], // For RedisService and SlackService access
  controllers: [ObserverController],
  providers: [ObserverService],
  exports: [ObserverService],
})
export class ObserverModule {}
