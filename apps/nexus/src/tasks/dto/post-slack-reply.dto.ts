import { IsString, IsBoolean, IsOptional, MinLength } from 'class-validator';

/**
 * DTO for posting a reply to a task's Slack thread.
 */
export class PostSlackReplyDto {
  @IsString()
  @MinLength(1)
  message: string;

  @IsBoolean()
  @IsOptional()
  broadcast?: boolean;
}
