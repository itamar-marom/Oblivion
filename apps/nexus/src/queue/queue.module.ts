import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

/**
 * Queue names used throughout the application.
 */
export const QUEUE_NAMES = {
  WEBHOOK_PROCESSING: 'webhook-processing',
  RAG_INGESTION: 'rag-ingestion',
} as const;

/**
 * Queue Module configures BullMQ with Redis for durable job processing.
 *
 * Queues:
 * - webhook-processing: ClickUp/Slack webhooks
 * - rag-ingestion: Vector embeddings for Memory Bank
 *
 * Usage in other modules:
 *   imports: [QueueModule]
 *
 * Then inject queues:
 *   @InjectQueue('webhook-processing') private queue: Queue
 */
@Module({
  imports: [
    // Configure BullMQ connection to Redis
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 1000, // Keep last 1000 failed jobs for debugging
      },
    }),

    // Register webhook processing queue
    BullModule.registerQueue({
      name: QUEUE_NAMES.WEBHOOK_PROCESSING,
    }),

    // Register RAG ingestion queue (for future Memory Bank)
    BullModule.registerQueue({
      name: QUEUE_NAMES.RAG_INGESTION,
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
