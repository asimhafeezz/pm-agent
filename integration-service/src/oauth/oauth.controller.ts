import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OAuthAuthorizeQueryDto } from './dto/oauth-authorize-query.dto';
import { OAuthRefreshDto } from './dto/oauth-refresh.dto';
import { OAuthTokenDto } from './dto/oauth-token.dto';
import { OAuthService } from './oauth.service';

@Controller('oauth')
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  @Get(':provider/authorize')
  authorize(
    @Param('provider') provider: string,
    @Query() query: OAuthAuthorizeQueryDto,
  ) {
    return this.oauthService.authorize(provider, query.redirectUri, query.state);
  }

  @Post(':provider/token')
  exchangeCode(
    @Param('provider') provider: string,
    @Body() body: OAuthTokenDto,
  ) {
    return this.oauthService.exchangeCode(provider, body.code, body.redirectUri);
  }

  @Post(':provider/refresh')
  refreshToken(
    @Param('provider') provider: string,
    @Body() body: OAuthRefreshDto,
  ) {
    return this.oauthService.refresh(provider, body.refreshToken);
  }
}
