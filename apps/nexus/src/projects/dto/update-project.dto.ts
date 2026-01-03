import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

/**
 * DTO for updating an existing Project.
 * All fields are optional - only provided fields are updated.
 */
export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
