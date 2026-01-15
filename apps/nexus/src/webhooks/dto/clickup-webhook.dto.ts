/**
 * ClickUp Webhook DTOs
 *
 * ClickUp sends webhooks for various events. We handle:
 * - taskCreated: New task created
 * - taskUpdated: Task properties changed
 * - taskCommentPosted: New comment on a task
 *
 * Reference: https://clickup.com/api/developer-portal/webhooks
 */

/**
 * ClickUp webhook event types we handle.
 */
export enum ClickUpEventType {
  TASK_CREATED = 'taskCreated',
  TASK_UPDATED = 'taskUpdated',
  TASK_COMMENT_POSTED = 'taskCommentPosted',
  TASK_DELETED = 'taskDeleted',
  TASK_STATUS_UPDATED = 'taskStatusUpdated',
}

/**
 * ClickUp user reference.
 */
export interface ClickUpUser {
  id: number;
  username: string;
  email: string;
  color?: string;
  profilePicture?: string;
}

/**
 * ClickUp task status.
 */
export interface ClickUpStatus {
  id: string;
  status: string;
  color: string;
  orderindex: number;
  type: string;
}

/**
 * ClickUp task data in webhook payload.
 */
export interface ClickUpTask {
  id: string;
  custom_id?: string;
  name: string;
  text_content?: string;
  description?: string;
  status: ClickUpStatus;
  orderindex: string;
  date_created: string;
  date_updated: string;
  date_closed?: string;
  creator: ClickUpUser;
  assignees: ClickUpUser[];
  watchers?: ClickUpUser[];
  checklists?: unknown[];
  tags?: { name: string; tag_fg: string; tag_bg: string }[];
  parent?: string;
  priority?: {
    id: string;
    priority: string;
    color: string;
    orderindex: string;
  };
  due_date?: string;
  start_date?: string;
  folder: { id: string; name: string; hidden: boolean; access: boolean };
  space: { id: string };
  list: { id: string; name: string; access: boolean };
  url: string;
}

/**
 * ClickUp comment data.
 */
export interface ClickUpComment {
  id: string;
  comment_text: string;
  user: ClickUpUser;
  date: string;
  resolved: boolean;
}

/**
 * ClickUp webhook payload history item.
 */
export interface ClickUpHistoryItem {
  id: string;
  type: number;
  date: string;
  field: string;
  parent_id: string;
  data: Record<string, unknown>;
  source?: string;
  user: ClickUpUser;
  before?: unknown;
  after?: unknown;
  // Present when field === 'comment'
  comment?: {
    id: string;
    comment_text?: string;
    text_content?: string;
    user: ClickUpUser;
    date: string;
  };
}

/**
 * Main ClickUp webhook payload structure.
 */
export interface ClickUpWebhookPayload {
  event: ClickUpEventType;
  webhook_id: string;
  task_id: string;
  history_items?: ClickUpHistoryItem[];
}

/**
 * Parsed ClickUp webhook for queue processing.
 */
export interface ClickUpWebhookJob {
  event: ClickUpEventType;
  webhookId: string;
  taskId: string;
  listId?: string;
  spaceId?: string;
  receivedAt: string;
  raw: ClickUpWebhookPayload;
}

/**
 * Job types for the webhook processing queue.
 */
export const CLICKUP_JOB_TYPES = {
  TASK_CREATED: 'clickup:task-created',
  TASK_UPDATED: 'clickup:task-updated',
  TASK_COMMENT: 'clickup:task-comment',
} as const;
