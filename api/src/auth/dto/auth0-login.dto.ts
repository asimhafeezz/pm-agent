import { IsNotEmpty, IsString } from 'class-validator';

export class Auth0LoginDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  redirectUri: string;
}
