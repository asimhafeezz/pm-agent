import { IsOptional, IsString } from 'class-validator';

export class EarliestTimestampDto {
  @IsOptional()
  @IsString()
  symbol?: string;

  @IsOptional()
  @IsString()
  interval?: string;
}
