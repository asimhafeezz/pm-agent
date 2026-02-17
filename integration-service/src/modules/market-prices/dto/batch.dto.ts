import { IsOptional, IsString } from 'class-validator';

export class BatchDto {
  @IsOptional()
  @IsString()
  symbols?: string;

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
}
