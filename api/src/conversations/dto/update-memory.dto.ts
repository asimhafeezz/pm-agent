import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class MemorySummaryDto {
  @IsString()
  summary: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keyFacts?: string[];

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lastMessageIds?: string[];
}

export class TopicMemoryDto extends MemorySummaryDto {
  @IsString()
  topicKey: string;
}

export class UserMemoryDto extends MemorySummaryDto {
  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  sourceConversationId?: string;
}

export class UpdateMemoryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => MemorySummaryDto)
  conversationSummary?: MemorySummaryDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TopicMemoryDto)
  topics?: TopicMemoryDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserMemoryDto)
  userMemories?: UserMemoryDto[];
}
