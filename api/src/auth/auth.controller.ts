import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './current-user.decorator';
import { Auth0LoginDto } from './dto/auth0-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() payload: RegisterDto) {
    return this.authService.register(payload);
  }

  @Post('login')
  async login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Post('auth0-login')
  async auth0Login(@Body() payload: Auth0LoginDto) {
    return this.authService.loginWithAuth0Code(payload.code, payload.redirectUri);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: { id: string }) {
    return this.authService.getUser(user.id);
  }
}
