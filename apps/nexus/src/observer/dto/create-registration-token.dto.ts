import { IsString, IsOptional, IsNumber, Min, IsUUID } from 'class-validator';

export class CreateRegistrationTokenDto {
  @IsString()
  @IsUUID()
  groupId: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  expiresInHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUses?: number;
}
