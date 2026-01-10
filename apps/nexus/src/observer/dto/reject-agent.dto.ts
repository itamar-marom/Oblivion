import { IsString, IsOptional, MaxLength } from 'class-validator';

export class RejectAgentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
