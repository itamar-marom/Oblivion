import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * WebhookSecurityService handles signature verification for webhooks.
 *
 * Security:
 * - ClickUp: HMAC-SHA256 signature in x-signature header
 * - Slack: HMAC-SHA256 signature with v0:{timestamp}:{body} format
 *
 * Environment Variables:
 * - CLICKUP_WEBHOOK_SECRET: Secret from ClickUp webhook configuration
 * - SLACK_SIGNING_SECRET: Signing secret from Slack app settings
 */
@Injectable()
export class WebhookSecurityService {
  private readonly logger = new Logger(WebhookSecurityService.name);
  private readonly clickUpSecret: string | undefined;
  private readonly slackSigningSecret: string | undefined;

  // Slack allows 5 minutes of clock drift for replay attack prevention
  private readonly SLACK_TIMESTAMP_TOLERANCE_SECONDS = 300;

  constructor(private configService: ConfigService) {
    this.clickUpSecret = this.configService.get<string>('CLICKUP_WEBHOOK_SECRET');
    this.slackSigningSecret = this.configService.get<string>('SLACK_SIGNING_SECRET');

    if (!this.clickUpSecret) {
      this.logger.warn('CLICKUP_WEBHOOK_SECRET not configured - signature verification disabled');
    }
    if (!this.slackSigningSecret) {
      this.logger.warn('SLACK_SIGNING_SECRET not configured - signature verification disabled');
    }
  }

  /**
   * Check if ClickUp signature verification is enabled.
   */
  isClickUpVerificationEnabled(): boolean {
    return !!this.clickUpSecret;
  }

  /**
   * Check if Slack signature verification is enabled.
   */
  isSlackVerificationEnabled(): boolean {
    return !!this.slackSigningSecret;
  }

  /**
   * Verify ClickUp webhook signature.
   *
   * ClickUp signs webhooks using HMAC-SHA256:
   * signature = HMAC-SHA256(webhook_secret, JSON.stringify(body))
   *
   * @param body - The raw request body (parsed JSON)
   * @param signature - The x-signature header value
   * @returns true if signature is valid or verification is disabled
   */
  verifyClickUpSignature(body: unknown, signature: string | undefined): boolean {
    // If no secret configured, skip verification (dev mode)
    if (!this.clickUpSecret) {
      this.logger.debug('ClickUp signature verification skipped (no secret configured)');
      return true;
    }

    // Signature is required when secret is configured
    if (!signature) {
      this.logger.warn('ClickUp webhook missing x-signature header');
      return false;
    }

    try {
      // ClickUp sends the signature as a hex-encoded HMAC-SHA256 hash
      const bodyString = JSON.stringify(body);
      const expectedSignature = crypto
        .createHmac('sha256', this.clickUpSecret)
        .update(bodyString)
        .digest('hex');

      // Constant-time comparison to prevent timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );

      if (!isValid) {
        this.logger.warn('ClickUp webhook signature mismatch');
      }

      return isValid;
    } catch (error) {
      this.logger.error(`ClickUp signature verification error: ${error}`);
      return false;
    }
  }

  /**
   * Verify Slack webhook signature.
   *
   * Slack signs webhooks using HMAC-SHA256 with a versioned format:
   * 1. Concatenate "v0:{timestamp}:{body}"
   * 2. HMAC-SHA256 with signing secret
   * 3. Prepend "v0=" to create final signature
   *
   * Also validates timestamp to prevent replay attacks.
   *
   * @param rawBody - The raw request body as a string
   * @param signature - The x-slack-signature header value
   * @param timestamp - The x-slack-request-timestamp header value
   * @returns true if signature is valid or verification is disabled
   */
  verifySlackSignature(
    rawBody: string,
    signature: string | undefined,
    timestamp: string | undefined,
  ): boolean {
    // If no secret configured, skip verification (dev mode)
    if (!this.slackSigningSecret) {
      this.logger.debug('Slack signature verification skipped (no secret configured)');
      return true;
    }

    // Both signature and timestamp are required when secret is configured
    if (!signature || !timestamp) {
      this.logger.warn('Slack webhook missing signature or timestamp headers');
      return false;
    }

    try {
      // Check timestamp to prevent replay attacks
      const requestTimestamp = parseInt(timestamp, 10);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(currentTimestamp - requestTimestamp);

      if (timeDiff > this.SLACK_TIMESTAMP_TOLERANCE_SECONDS) {
        this.logger.warn(
          `Slack webhook timestamp too old: ${timeDiff}s (max: ${this.SLACK_TIMESTAMP_TOLERANCE_SECONDS}s)`,
        );
        return false;
      }

      // Compute expected signature
      // Format: v0:{timestamp}:{body}
      const sigBaseString = `v0:${timestamp}:${rawBody}`;
      const expectedSignature =
        'v0=' +
        crypto
          .createHmac('sha256', this.slackSigningSecret)
          .update(sigBaseString)
          .digest('hex');

      // Constant-time comparison to prevent timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );

      if (!isValid) {
        this.logger.warn('Slack webhook signature mismatch');
      }

      return isValid;
    } catch (error) {
      this.logger.error(`Slack signature verification error: ${error}`);
      return false;
    }
  }
}
