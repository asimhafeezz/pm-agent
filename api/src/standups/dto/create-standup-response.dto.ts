import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateStandupResponseDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsString()
  @IsNotEmpty()
  respondent: string;

  @IsOptional()
  @IsString()
  respondentUserId?: string;

  @IsString()
  @IsNotEmpty()
  rawText: string;

  @IsOptional()
  @IsString()
  yesterday?: string;

  @IsOptional()
  @IsString()
  today?: string;

  @IsOptional()
  @IsString()
  blockers?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
