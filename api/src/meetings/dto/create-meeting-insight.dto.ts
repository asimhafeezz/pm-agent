import { IsArray, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { InsightType, InsightStatus } from '../entities/meeting-insight.entity';

export class CreateMeetingInsightDto {
  @IsEnum(InsightType)
  insightType: InsightType;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsString()
  assignee?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class BulkCreateInsightsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMeetingInsightDto)
  insights: CreateMeetingInsightDto[];
}
