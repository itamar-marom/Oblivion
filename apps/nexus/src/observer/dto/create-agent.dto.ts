import { IsString, IsOptional, IsArray, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateAgentDto {
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
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];
}
