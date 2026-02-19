import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ImportGoogleDocumentDto {
  @IsString()
  @IsNotEmpty()
  document: string;

  @IsString()
  @IsOptional()
  title?: string;
}
