import { IsOptional, IsString } from 'class-validator';

export class SymbolDto {
  @IsOptional()
  @IsString()
  symbol?: string;
}
