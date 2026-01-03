/**
 * Slack Events API DTOs
 *
 * Slack sends events via the Events API. We handle:
 * - message: New message in a channel (including threads)
 * - app_mention: Bot was @mentioned
 * - channel_created: New channel created
 *
 * Reference: https://api.slack.com/apis/events-api
 */

/**
 * Slack event types we handle.
 */
export enum SlackEventType {
  MESSAGE = 'message',
  APP_MENTION = 'app_mention',
  CHANNEL_CREATED = 'channel_created',
  URL_VERIFICATION = 'url_verification',
}

/**
 * Slack message subtypes (not all are relevant to us).
 */
export enum SlackMessageSubtype {
  BOT_MESSAGE = 'bot_message',
  MESSAGE_CHANGED = 'message_changed',
  MESSAGE_DELETED = 'message_deleted',
  THREAD_BROADCAST = 'thread_broadcast',
}

/**
 * Slack user info in events.
 */
export interface SlackUser {
  id: string;
  team_id: string;
  name?: string;
  real_name?: string;
}

/**
 * Slack channel info.
 */
export interface SlackChannel {
  id: string;
  name: string;
  is_channel?: boolean;
  is_private?: boolean;
  created?: number;
  creator?: string;
}

/**
 * Slack message event.
 */
export interface SlackMessageEvent {
  type: 'message';
  subtype?: SlackMessageSubtype;
  channel: string;
  user?: string;
  text: string;
  ts: string;
  thread_ts?: string; // Present if this is a reply in a thread
  event_ts: string;
  channel_type?: string;
  bot_id?: string;
  app_id?: string;
}

/**
 * Slack app_mention event.
 */
export interface SlackAppMentionEvent {
  type: 'app_mention';
  user: string;
  text: string;
  ts: string;
  channel: string;
  event_ts: string;
  thread_ts?: string;
}

/**
 * Slack channel_created event.
 */
export interface SlackChannelCreatedEvent {
  type: 'channel_created';
  channel: SlackChannel;
}

/**
 * URL verification challenge (sent once when setting up Events API).
 */
export interface SlackUrlVerification {
  type: 'url_verification';
  token: string;
  challenge: string;
}

/**
 * Main Slack Events API payload wrapper.
 */
export interface SlackEventPayload {
  token: string;
  team_id: string;
  api_app_id: string;
  event: SlackMessageEvent | SlackAppMentionEvent | SlackChannelCreatedEvent;
  type: 'event_callback';
  event_id: string;
  event_time: number;
  authed_users?: string[];
  authorizations?: {
    enterprise_id?: string;
    team_id: string;
    user_id: string;
    is_bot: boolean;
  }[];
}

/**
 * Combined type for all Slack webhook payloads.
 */
export type SlackWebhookPayload = SlackEventPayload | SlackUrlVerification;

/**
 * Parsed Slack webhook for queue processing.
 */
export interface SlackWebhookJob {
  eventType: string;
  teamId: string;
  channelId: string;
  threadTs?: string;
  messageTs: string;
  userId?: string;
  text?: string;
  isBotMessage: boolean;
  receivedAt: string;
  raw: SlackEventPayload;
}

/**
 * Job types for the webhook processing queue.
 */
export const SLACK_JOB_TYPES = {
  MESSAGE: 'slack:message',
  APP_MENTION: 'slack:app-mention',
  CHANNEL_CREATED: 'slack:channel-created',
} as const;
