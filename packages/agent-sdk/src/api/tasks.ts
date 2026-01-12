/**
 * Task API
 *
 * Operations for managing tasks.
 */

import type { HttpClient } from './http-client.js';
import type {
  Task,
  AvailableTask,
  ClaimTaskResult,
  UpdateStatusResult,
  TaskUpdateStatus,
} from '../types/index.js';

export class TaskApi {
  private http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  /**
   * Get available (unclaimed) tasks.
   */
  async listAvailable(): Promise<AvailableTask[]> {
    return this.http.get<AvailableTask[]>('/tasks/available');
  }

  /**
   * Get tasks claimed by the current agent.
   */
  async listClaimed(): Promise<Task[]> {
    return this.http.get<Task[]>('/tasks/claimed');
  }

  /**
   * Get a specific task by ClickUp ID.
   */
  async get(clickupTaskId: string): Promise<Task> {
    return this.http.get<Task>(`/tasks/${clickupTaskId}`);
  }

  /**
   * Get a specific task by internal ID.
   */
  async getById(taskId: string): Promise<Task> {
    return this.http.get<Task>(`/tasks/by-id/${taskId}`);
  }

  /**
   * Claim a task.
   * Note: retryOn401 is disabled because claiming is not idempotent.
   */
  async claim(taskId: string): Promise<ClaimTaskResult> {
    return this.http.post<ClaimTaskResult>(`/tasks/${taskId}/claim`, undefined, { retryOn401: false });
  }

  /**
   * Update task status.
   */
  async updateStatus(taskId: string, status: TaskUpdateStatus): Promise<UpdateStatusResult> {
    return this.http.patch<UpdateStatusResult>(`/tasks/${taskId}/status`, { status });
  }

  /**
   * Get task context (detailed info including Slack thread).
   */
  async getContext(taskId: string): Promise<Task> {
    return this.http.get<Task>(`/tasks/${taskId}/context`);
  }
}
