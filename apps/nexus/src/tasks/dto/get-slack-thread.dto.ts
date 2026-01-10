import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for retrieving Slack thread messages.
 *
 * Query parameters for GET /tasks/:id/slack-thread
 */
export class GetSlackThreadDto {
  /**
   * Maximum number of messages to retrieve.
   * Default: 15
   * Max: 15 (Slack API limit for new non-Marketplace apps)
   */
  @IsInt()
  @Min(1)
  @Max(15)
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  /**
   * Pagination cursor from previous response.
   * Use to fetch older messages beyond the initial limit.
   */
  @IsString()
  @IsOptional()
  cursor?: string;
}
