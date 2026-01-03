import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebhooksController } from './webhooks.controller';
import { WebhookProcessor } from './processors/webhook.processor';
import { WebhookSecurityService } from './services/webhook-security.service';
import { QueueModule } from '../queue/queue.module';
import { GatewayModule } from '../gateway/gateway.module';
import { ProjectsModule } from '../projects/projects.module';
import { TasksModule } from '../tasks/tasks.module';

/**
 * Webhooks Module handles incoming webhooks from ClickUp and Slack.
 *
 * Components:
 * - WebhooksController: HTTP endpoints for webhook ingestion
 * - WebhookProcessor: Unified BullMQ processor for all webhook events
 * - WebhookSecurityService: Signature verification for ClickUp and Slack
 *
 * Endpoints:
 * - POST /webhooks/clickup - ClickUp task events
 * - POST /webhooks/slack   - Slack Events API
 * - POST /webhooks/health  - Queue health check
 *
 * Security:
 * - ClickUp: HMAC-SHA256 signature verification (x-signature header)
 * - Slack: HMAC-SHA256 signature verification (x-slack-signature header)
 *
 * Flow:
 * 1. Webhook arrives → Controller validates signature
 * 2. If valid → Enqueues to BullMQ
 * 3. Returns 200 OK immediately
 * 4. Processor handles job asynchronously
 * 5. Emits WebSocket events to agents
 */
@Module({
  imports: [
    QueueModule,
    GatewayModule,
    ConfigModule,
    ProjectsModule, // For @tag routing lookup
    TasksModule, // For task creation and broadcasting
  ],
  controllers: [WebhooksController],
  providers: [WebhookProcessor, WebhookSecurityService],
})
export class WebhooksModule {}
