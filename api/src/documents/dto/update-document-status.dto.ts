import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { DocumentStatus } from '../entities/document.entity';

export class UpdateDocumentStatusDto {
  @IsEnum(DocumentStatus)
  status: DocumentStatus;

  @IsOptional()
  @IsString()
  processingError?: string;

  @IsOptional()
  @IsInt()
  chunkCount?: number;
}
