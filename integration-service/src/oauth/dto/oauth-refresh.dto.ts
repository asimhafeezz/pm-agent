import { IsNotEmpty, IsString } from 'class-validator';

export class OAuthRefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
