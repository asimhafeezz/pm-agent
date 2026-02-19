import { IsNotEmpty, IsString } from 'class-validator';

export class OAuthTokenDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  redirectUri: string;
}
