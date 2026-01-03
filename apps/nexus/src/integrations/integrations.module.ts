import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClickUpService } from './clickup/clickup.service';
import { SlackService } from './slack/slack.service';

/**
 * IntegrationsModule provides API clients for external services.
 *
 * Services:
 * - ClickUpService: ClickUp API client (tasks, comments)
 * - SlackService: Slack API client (messages, threads)
 *
 * This module is global so services can be injected anywhere.
 *
 * Required Environment Variables:
 * - CLICKUP_API_TOKEN: ClickUp Personal API Token or OAuth token
 * - SLACK_BOT_TOKEN: Slack Bot Token (xoxb-*)
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [ClickUpService, SlackService],
  exports: [ClickUpService, SlackService],
})
export class IntegrationsModule {}
