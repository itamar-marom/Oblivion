import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Request } from 'express';
import { QUEUE_NAMES } from '../queue/queue.module';
import { ClickUpEventType, CLICKUP_JOB_TYPES } from './dto/clickup-webhook.dto';
import type {
  ClickUpWebhookPayload,
  ClickUpWebhookJob,
} from './dto/clickup-webhook.dto';
import { SLACK_JOB_TYPES } from './dto/slack-webhook.dto';
import type {
  SlackWebhookPayload,
  SlackWebhookJob,
} from './dto/slack-webhook.dto';
import { WebhookSecurityService } from './services/webhook-security.service';

/**
 * WebhooksController handles incoming webhooks from ClickUp and Slack.
 *
 * Strategy:
 * 1. Validate webhook signature (TODO: implement signature verification)
 * 2. Enqueue webhook to BullMQ for async processing
 * 3. Return 200 OK immediately (critical for webhook reliability)
 *
 * Endpoints:
 * - POST /webhooks/clickup - ClickUp task events
 * - POST /webhooks/slack   - Slack Events API
 */
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.WEBHOOK_PROCESSING)
    private webhookQueue: Queue,
    private securityService: WebhookSecurityService,
  ) {}

  /**
   * Handle ClickUp webhooks.
   *
   * Events:
   * - taskCreated: New task assigned to agent
   * - taskUpdated: Task status changed
   * - taskCommentPosted: Human commented on task
   */
  @Post('clickup')
  @HttpCode(HttpStatus.OK)
  async handleClickUp(
    @Body() payload: ClickUpWebhookPayload,
    @Headers('x-signature') signature?: string,
  ): Promise<{ status: string; jobId?: string }> {
    const receivedAt = new Date().toISOString();

    this.logger.log(
      `ClickUp webhook received: ${payload.event} (task: ${payload.task_id})`,
    );

    // Verify webhook signature
    if (!this.securityService.verifyClickUpSignature(payload, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Determine job type based on event
    let jobType: string;
    switch (payload.event) {
      case ClickUpEventType.TASK_CREATED:
        jobType = CLICKUP_JOB_TYPES.TASK_CREATED;
        break;
      case ClickUpEventType.TASK_UPDATED:
      case ClickUpEventType.TASK_STATUS_UPDATED:
        jobType = CLICKUP_JOB_TYPES.TASK_UPDATED;
        break;
      case ClickUpEventType.TASK_COMMENT_POSTED:
        jobType = CLICKUP_JOB_TYPES.TASK_COMMENT;
        break;
      default:
        this.logger.debug(`Ignoring ClickUp event: ${payload.event}`);
        return { status: 'ignored' };
    }

    // Create job data
    const jobData: ClickUpWebhookJob = {
      event: payload.event,
      webhookId: payload.webhook_id,
      taskId: payload.task_id,
      receivedAt,
      raw: payload,
    };

    // Enqueue for async processing
    const job = await this.webhookQueue.add(jobType, jobData, {
      jobId: `clickup-${payload.webhook_id}-${Date.now()}`,
    });

    this.logger.debug(`Queued ClickUp job: ${job.id}`);

    return { status: 'queued', jobId: job.id };
  }

  /**
   * Handle Slack Events API webhooks.
   *
   * Events:
   * - url_verification: Challenge for Events API setup
   * - message: New message in tracked channel/thread
   * - app_mention: Bot was @mentioned
   */
  @Post('slack')
  @HttpCode(HttpStatus.OK)
  async handleSlack(
    @Req() req: Request & { rawBody?: Buffer },
    @Body() payload: SlackWebhookPayload,
    @Headers('x-slack-signature') signature?: string,
    @Headers('x-slack-request-timestamp') timestamp?: string,
  ): Promise<{ status: string; jobId?: string } | { challenge: string }> {
    const receivedAt = new Date().toISOString();

    // Handle URL verification challenge (one-time setup)
    // Note: Skip signature verification for URL verification as Slack may not
    // sign these requests consistently during initial setup
    if (payload.type === 'url_verification') {
      this.logger.log('Slack URL verification challenge received');
      return { challenge: (payload as { challenge: string }).challenge };
    }

    // Get raw body for signature verification
    const rawBody = req.rawBody?.toString() || JSON.stringify(payload);

    // Verify Slack signature
    if (
      !this.securityService.verifySlackSignature(rawBody, signature, timestamp)
    ) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Cast to event payload (after URL verification check, we know it's SlackEventPayload)
    const eventPayload = payload as {
      type: string;
      team_id: string;
      event_id: string;
      event: {
        type: string;
        channel?: string | { id: string };
        thread_ts?: string;
        ts?: string;
        user?: string;
        text?: string;
        bot_id?: string;
        subtype?: string;
      };
    };
    const event = eventPayload.event;

    this.logger.log(
      `Slack webhook received: ${event.type} (team: ${eventPayload.team_id})`,
    );

    // Skip bot messages to avoid infinite loops
    if (event.type === 'message') {
      if (event.bot_id || event.subtype === 'bot_message') {
        this.logger.debug('Ignoring bot message');
        return { status: 'ignored' };
      }
    }

    // Determine job type based on event
    let jobType: string;
    switch (event.type) {
      case 'message':
        jobType = SLACK_JOB_TYPES.MESSAGE;
        break;
      case 'app_mention':
        jobType = SLACK_JOB_TYPES.APP_MENTION;
        break;
      case 'channel_created':
        jobType = SLACK_JOB_TYPES.CHANNEL_CREATED;
        break;
      default:
        this.logger.debug(`Ignoring Slack event: ${event.type}`);
        return { status: 'ignored' };
    }

    // Extract channel ID (handle both string and object forms)
    let channelId = '';
    if (event.channel) {
      channelId =
        typeof event.channel === 'string' ? event.channel : event.channel.id;
    }

    // Create job data for message events
    const jobData: SlackWebhookJob = {
      eventType: event.type,
      teamId: eventPayload.team_id,
      channelId,
      threadTs: event.thread_ts,
      messageTs: event.ts || eventPayload.event_id,
      userId: event.user,
      text: event.text,
      isBotMessage: !!(event.bot_id || event.subtype === 'bot_message'),
      receivedAt,
      raw: eventPayload as unknown as import('./dto/slack-webhook.dto').SlackEventPayload,
    };

    // Enqueue for async processing
    const job = await this.webhookQueue.add(jobType, jobData, {
      jobId: `slack-${eventPayload.event_id}`,
    });

    this.logger.debug(`Queued Slack job: ${job.id}`);

    return { status: 'queued', jobId: job.id };
  }

  /**
   * Health check endpoint for webhook infrastructure.
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  async health(): Promise<{ status: string; queue: string }> {
    const count = await this.webhookQueue.count();
    return {
      status: 'ok',
      queue: `${count} jobs pending`,
    };
  }
}
