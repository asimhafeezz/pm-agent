import { IsOptional, IsString } from 'class-validator';

export class EarningsCalendarDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
