import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { IntegrationsModule } from '../integrations/integrations.module';

/**
 * Projects Module.
 *
 * Manages Work Scopes (Projects) - the Level 2 hierarchy.
 *
 * Features:
 * - CRUD operations for projects
 * - @tag routing for ClickUp integration
 * - Slack channel auto-creation (via SlackService)
 * - Task statistics
 *
 * Projects:
 * - Belong to exactly one Group
 * - Have a unique oblivionTag for ClickUp routing (e.g., @auth-refactor)
 * - Have a dedicated Slack channel (#oblivion-{slug})
 * - Contain multiple Tasks
 */
@Module({
  imports: [IntegrationsModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
