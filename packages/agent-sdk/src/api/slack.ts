/**
 * Slack API
 *
 * Operations for Slack messaging.
 */

import type { HttpClient } from './http-client.js';
import type { SlackThreadReplyResult, SlackThreadResult } from '../types/index.js';

export class SlackApi {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Post a message to a task's Slack thread.
   * Note: retryOn401 is disabled because posting messages is not idempotent.
   */
  async postToThread(
    taskId: string,
    message: string,
    options?: { broadcast?: boolean }
  ): Promise<SlackThreadReplyResult> {
    return this.http.post<SlackThreadReplyResult>(
      `/tasks/${taskId}/slack-reply`,
      {
        message,
        broadcast: options?.broadcast,
      },
      { retryOn401: false }
    );
  }

  /**
   * Get Slack thread messages for a task.
   */
  async getThread(
    taskId: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<SlackThreadResult> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.cursor) params.append('cursor', options.cursor);

    const query = params.toString() ? `?${params.toString()}` : '';

    return this.http.get<SlackThreadResult>(`/tasks/${taskId}/slack-thread${query}`);
  }
}
