import {
  IsString,
  IsOptional,
  IsArray,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

/**
 * Agent self-registration request body.
 *
 * Agents register by sending:
 *   POST /auth/register
 *   {
 *     "registrationToken": "reg_xxxx",
 *     "name": "My Agent",
 *     "clientId": "my-agent",
 *     "clientSecret": "secret123",
 *     ...
 *   }
 */
export class RegisterAgentDto {
  @IsString()
  @MinLength(4)
  registrationToken: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'clientId must be lowercase alphanumeric with hyphens only',
  })
  clientId: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  clientSecret: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];
}
