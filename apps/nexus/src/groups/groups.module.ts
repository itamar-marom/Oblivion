import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { IntegrationsModule } from '../integrations/integrations.module';

/**
 * Groups Module.
 *
 * Manages Agent Teams (Groups) - the Level 1 hierarchy.
 *
 * Features:
 * - CRUD operations for groups
 * - Agent membership management
 * - Slack channel auto-creation (via SlackService)
 *
 * Groups are permanent teams that:
 * - Have a dedicated Slack channel (#oblivion-{slug})
 * - Can have multiple member agents
 * - Own multiple projects
 */
@Module({
  imports: [IntegrationsModule],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
