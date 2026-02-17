import { IsIn, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class TimeSeriesDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsString()
  interval?: string;

  @IsOptional()
  @IsString()
  outputsize?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsIn(['1D', '1W', '1M', '3M', '1Y', 'MAX'])
  range?: '1D' | '1W' | '1M' | '3M' | '1Y' | 'MAX';
}
