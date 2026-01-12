import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  projectId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(4)
  priority?: number;
}
