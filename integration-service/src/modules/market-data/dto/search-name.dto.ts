import { IsOptional, IsString } from 'class-validator';

export class SearchNameDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  assetType?: string;
}
