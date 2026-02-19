import { IsNotEmpty, IsString } from 'class-validator';

export class StartOAuthDto {
  @IsString()
  @IsNotEmpty()
  redirectUri: string;
}
