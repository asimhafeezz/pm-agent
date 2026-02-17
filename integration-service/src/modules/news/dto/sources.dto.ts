import { IsOptional, IsString } from 'class-validator';

export class SourcesDto {
  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  category?: string;
}
