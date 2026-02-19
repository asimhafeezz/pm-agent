import { IsArray, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ChunkDto {
  @IsInt()
  chunkIndex: number;

  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  embedding?: number[];

  @IsOptional()
  @IsInt()
  tokenCount?: number;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class BulkCreateChunksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChunkDto)
  chunks: ChunkDto[];
}
