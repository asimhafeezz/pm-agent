import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OAuthCallbackDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  redirectUri: string;

  @IsOptional()
  @IsString()
  provider?: string;
}
