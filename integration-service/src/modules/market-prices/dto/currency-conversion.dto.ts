import { IsOptional, IsString } from 'class-validator';

export class CurrencyConversionDto {
  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
