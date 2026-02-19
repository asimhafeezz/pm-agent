import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ImportNotionDocumentDto {
  @IsString()
  @IsNotEmpty()
  page: string;

  @IsString()
  @IsOptional()
  title?: string;
}
