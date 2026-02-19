import { IsNotEmpty, IsString } from 'class-validator';

export class OAuthAuthorizeQueryDto {
  @IsString()
  @IsNotEmpty()
  redirectUri: string;

  @IsString()
  @IsNotEmpty()
  state: string;
}
