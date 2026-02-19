import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class RawQueryDto {
  @IsString()
  @IsNotEmpty()
  query!: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}
