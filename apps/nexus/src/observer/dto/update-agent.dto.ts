import { IsString, IsEmail, IsOptional, IsArray, IsUrl } from 'class-validator';

/**
 * DTO for updating an agent's profile.
 *
 * Updatable fields:
 * - name: Display name
 * - description: Role description
 * - email: Contact email (used for Slack user lookup)
 * - avatarUrl: Avatar URL for Slack messages
 * - slackUserId: Slack User ID (can be set manually or auto-discovered)
 * - capabilities: Array of capability tags
 */
export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  slackUserId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];
}
