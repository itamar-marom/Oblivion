import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
  IsUUID,
} from 'class-validator';

/**
 * DTO for creating a new Project.
 * Projects belong to a Group and have a unique @tag for ClickUp routing.
 * Slack channel is auto-created when the project is created.
 */
export class CreateProjectDto {
  @IsUUID()
  groupId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens only',
  })
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Oblivion tag must be lowercase alphanumeric with hyphens only (without @)',
  })
  oblivionTag?: string;
}
