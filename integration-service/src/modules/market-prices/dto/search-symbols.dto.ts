import { IsOptional, IsString } from 'class-validator';

export class SearchSymbolsDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  exchange?: string;

  @IsOptional()
  @IsString()
  country?: string;
}
