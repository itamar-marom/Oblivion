import { IsString, IsOptional, IsIn } from 'class-validator';

/**
 * DTO for adding an agent to a group.
 */
export class AddMemberDto {
  @IsString()
  agentId: string;

  @IsOptional()
  @IsString()
  @IsIn(['member', 'lead'])
  role?: string = 'member';
}
