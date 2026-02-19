import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
