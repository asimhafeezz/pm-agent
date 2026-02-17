import { IsOptional, IsString } from 'class-validator';

export class ExchangeRateDto {
  @IsOptional()
  @IsString()
  pair?: string;
}
