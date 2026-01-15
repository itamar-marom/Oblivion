import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for updating task status.
 */
export class UpdateTaskStatusDto {
  @ApiProperty({
    description: 'New task status',
    enum: ['IN_PROGRESS', 'BLOCKED_ON_HUMAN', 'DONE'],
    example: 'IN_PROGRESS',
  })
  @IsString()
  @IsIn(['IN_PROGRESS', 'BLOCKED_ON_HUMAN', 'DONE'])
  status: 'IN_PROGRESS' | 'BLOCKED_ON_HUMAN' | 'DONE';
}
