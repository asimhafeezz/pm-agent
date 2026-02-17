import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAgentRunDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsOptional()
  userMessageId?: string;

  @IsString()
  @IsOptional()
  executionMode?: string;  // 'quick' | 'thinking'

  @IsBoolean()
  @IsOptional()
  deepAnalysis?: boolean;

  @IsString()
  @IsOptional()
  mode?: string;  // deprecated - kept for backward compatibility

  @IsOptional()
  config?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symbols?: string[];
}
