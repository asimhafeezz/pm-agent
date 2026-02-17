import { IsOptional, IsString } from 'class-validator';

export class ListStocksDto {
  @IsOptional()
  @IsString()
  exchange?: string;
}
