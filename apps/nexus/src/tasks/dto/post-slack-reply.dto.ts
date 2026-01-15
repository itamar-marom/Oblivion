import { IsString, IsBoolean, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for posting a reply to a task's Slack thread.
 */
export class PostSlackReplyDto {
  @ApiProperty({
    description: 'Message to post to the Slack thread',
    example: 'Working on this now!',
  })
  @IsString()
  @MinLength(1)
  message: string;

  @ApiPropertyOptional({
    description: 'Also post to channel (not just thread)',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  broadcast?: boolean;
}
