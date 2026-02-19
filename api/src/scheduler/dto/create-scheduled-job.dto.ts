import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { JobType } from '../entities/scheduled-job.entity';

export class CreateScheduledJobDto {
  @IsEnum(JobType)
  jobType: JobType;

  @IsString()
  @IsNotEmpty()
  cronExpression: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
