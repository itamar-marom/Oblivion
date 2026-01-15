import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * ClickUp Task response from API
 */
export interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  text_content?: string;
  status: {
    status: string;
    color: string;
    type: string;
  };
  assignees: Array<{
    id: number;
    username: string;
    email: string;
  }>;
  tags: Array<{
    name: string;
    tag_fg: string;
    tag_bg: string;
  }>;
  url: string;
  list: {
    id: string;
    name: string;
  };
  folder: {
    id: string;
    name: string;
  };
  space: {
    id: string;
  };
  creator: {
    id: number;
    username: string;
    email: string;
  };
  date_created: string;
  date_updated: string;
  due_date?: string;
  priority?: {
    id: string;
    priority: string;
    color: string;
  };
}

/**
 * ClickUp Comment response
 */
export interface ClickUpComment {
  id: string;
  comment_text: string;
  user: {
    id: number;
    username: string;
    email: string;
  };
  date: string;
}

/**
 * ClickUpService handles all interactions with the ClickUp API.
 *
 * Features:
 * - Fetch task details by ID
 * - Post comments to tasks
 * - Parse @mentions from task descriptions
 *
 * Authentication:
 * - Uses Personal API Token or OAuth2 access token
 * - Token configured via CLICKUP_API_TOKEN env var
 *
 * API Reference: https://clickup.com/api
 */
@Injectable()
export class ClickUpService {
  private readonly logger = new Logger(ClickUpService.name);
  private readonly client: AxiosInstance;
  private readonly apiToken: string;

  constructor(private configService: ConfigService) {
    this.apiToken = this.configService.get<string>('CLICKUP_API_TOKEN') || '';

    this.client = axios.create({
      baseURL: 'https://api.clickup.com/api/v2',
      headers: {
        Authorization: this.apiToken,
        'Content-Type': 'application/json',
      },
    });

    // Request/response logging
    this.client.interceptors.request.use((config) => {
      this.logger.debug(
        `ClickUp API: ${config.method?.toUpperCase()} ${config.url}`,
      );
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: {
        response?: { status?: number; data?: { err?: string } };
        message?: string;
      }) => {
        const message = `ClickUp API error: ${error.response?.status} ${error.response?.data?.err || error.message}`;
        this.logger.error(message);
        throw new Error(message);
      },
    );
  }

  /**
   * Check if the service is configured with an API token
   */
  isConfigured(): boolean {
    return !!this.apiToken;
  }

  /**
   * Fetch a task by ID
   *
   * @param taskId - ClickUp task ID
   * @returns Task details or null if not found
   */
  async getTask(taskId: string): Promise<ClickUpTask | null> {
    if (!this.isConfigured()) {
      this.logger.warn('ClickUp API token not configured');
      return null;
    }

    try {
      const response = await this.client.get<ClickUpTask>(`/task/${taskId}`);
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        this.logger.warn(`Task not found: ${taskId}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Post a comment to a task
   *
   * @param taskId - ClickUp task ID
   * @param comment - Comment text (supports markdown)
   * @returns Created comment or null on failure
   */
  async postComment(
    taskId: string,
    comment: string,
  ): Promise<ClickUpComment | null> {
    if (!this.isConfigured()) {
      this.logger.warn('ClickUp API token not configured');
      return null;
    }

    try {
      const response = await this.client.post<ClickUpComment>(
        `/task/${taskId}/comment`,
        {
          comment_text: comment,
        },
      );
      this.logger.log(`Comment posted to task ${taskId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to post comment to task ${taskId}: ${error}`);
      return null;
    }
  }

  /**
   * Parse @mentions from task description
   *
   * Looks for patterns like:
   * - @AI_Squad
   * - @CodeReviewer
   * - @BugFixer
   *
   * @param description - Task description text
   * @returns Array of mention strings (without @)
   */
  parseMentions(description: string): string[] {
    if (!description) {
      return [];
    }

    // Match @word patterns (alphanumeric + underscore)
    const mentionRegex = /@([A-Za-z0-9_]+)/g;
    const matches = description.matchAll(mentionRegex);
    const mentions = Array.from(matches, (m) => m[1]);

    // Deduplicate
    return [...new Set(mentions)];
  }

  /**
   * Parse Oblivion @tag from task description for project routing.
   *
   * Looks for patterns like:
   * - @auth-refactor
   * - @payment-v2
   * - @bug_fixes
   *
   * The tag should match a Project's `oblivionTag` field.
   * Only the FIRST @tag found is used for routing.
   *
   * @param description - Task description text
   * @returns The first oblivion tag found (without @), or null if none
   */
  parseOblivionTag(description: string): string | null {
    if (!description) {
      return null;
    }

    // Match @tag patterns (alphanumeric, underscore, hyphen)
    // More permissive than mentions to allow hyphens in project tags
    const tagRegex = /@([A-Za-z0-9_-]+)/g;
    const matches = description.matchAll(tagRegex);

    for (const match of matches) {
      const tag = match[1];
      // Return the first non-empty tag found
      if (tag && tag.length > 0) {
        return tag;
      }
    }

    return null;
  }

  /**
   * Check if a task description contains specific AI-related mentions
   *
   * @param description - Task description
   * @param targetMentions - Mentions to look for (e.g., ['AI_Squad', 'AI'])
   * @returns true if any target mention is found
   */
  hasAIMention(
    description: string,
    targetMentions: string[] = ['AI_Squad', 'AI', 'Agent'],
  ): boolean {
    const mentions = this.parseMentions(description);
    return mentions.some((m) => targetMentions.includes(m));
  }

  /**
   * Map ClickUp priority to internal priority (1-4 scale).
   *
   * ClickUp priorities:
   * - 1: Urgent (maps to 1)
   * - 2: High (maps to 2)
   * - 3: Normal (maps to 3)
   * - 4: Low (maps to 4)
   * - null/undefined: Normal (default 3)
   *
   * @param task - ClickUp task
   * @returns Priority number 1-4 (1 = highest)
   */
  mapPriority(task: ClickUpTask): number {
    if (!task.priority?.id) {
      return 3; // Default: Normal
    }

    const priorityId = parseInt(task.priority.id, 10);

    // ClickUp uses 1=Urgent, 2=High, 3=Normal, 4=Low
    // which maps directly to our system
    if (priorityId >= 1 && priorityId <= 4) {
      return priorityId;
    }

    return 3; // Default: Normal
  }

  /**
   * Extract task summary for Slack message
   *
   * @param task - ClickUp task
   * @returns Formatted summary object
   */
  extractTaskSummary(task: ClickUpTask): {
    title: string;
    description: string;
    status: string;
    priority: string | null;
    url: string;
    assignees: string[];
    tags: string[];
  } {
    return {
      title: task.name,
      description: task.text_content || task.description || '',
      status: task.status.status,
      priority: task.priority?.priority || null,
      url: task.url,
      assignees: task.assignees.map((a) => a.username),
      tags: task.tags.map((t) => t.name),
    };
  }
}
