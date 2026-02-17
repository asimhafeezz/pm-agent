import { IsIn, IsOptional, IsString } from 'class-validator';

export class RevenueSeriesDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsIn(['annual', 'quarter'])
  period?: 'annual' | 'quarter';

  @IsOptional()
  @IsString()
  limit?: string;
}
