import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CompleteAgentRunDto {
  @IsString()
  @IsNotEmpty()
  finalAnswerText: string;

  @IsOptional()
  decisionJson?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsObject()
  modelInfo?: Record<string, any>;

  @IsOptional()
  warnings?: string[];
}
