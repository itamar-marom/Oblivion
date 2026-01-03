import { IsString, IsIn } from 'class-validator';

/**
 * DTO for updating task status.
 */
export class UpdateTaskStatusDto {
  @IsString()
  @IsIn(['IN_PROGRESS', 'BLOCKED_ON_HUMAN', 'DONE'])
  status: 'IN_PROGRESS' | 'BLOCKED_ON_HUMAN' | 'DONE';
}
