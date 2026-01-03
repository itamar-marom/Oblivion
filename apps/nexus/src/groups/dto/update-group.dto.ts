import { IsString, IsOptional, IsBoolean, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for updating an existing Group.
 * All fields are optional - only provided fields are updated.
 */
export class UpdateGroupDto {
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
  @IsBoolean()
  isActive?: boolean;
}
