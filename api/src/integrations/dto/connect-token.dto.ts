import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class ConnectTokenDto {
  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

