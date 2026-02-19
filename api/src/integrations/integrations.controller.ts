import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ConnectTokenDto } from './dto/connect-token.dto';
import { OAuthCallbackDto } from './dto/oauth-callback.dto';
import { StartOAuthDto } from './dto/start-oauth.dto';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
@UseGuards(AuthGuard)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get(':provider/oauth/start')
  startOAuth(
    @CurrentUser() user: { id: string },
    @Param('provider') provider: string,
    @Query() query: StartOAuthDto,
  ) {
    return this.integrationsService.startOAuth(user.id, provider, query.redirectUri);
  }

  @Post('oauth/callback')
  completeOAuth(
    @CurrentUser() user: { id: string },
    @Body() body: OAuthCallbackDto,
  ) {
    return this.integrationsService.completeOAuth(user.id, body);
  }

  @Get()
  listStatuses(@CurrentUser() user: { id: string }) {
    return this.integrationsService.listStatuses(user.id);
  }

  @Get(':provider/status')
  providerStatus(
    @CurrentUser() user: { id: string },
    @Param('provider') provider: string,
  ) {
    return this.integrationsService.getStatus(user.id, provider);
  }

  @Get('document-sources/:provider/search')
  searchDocumentSource(
    @CurrentUser() user: { id: string },
    @Param('provider') provider: 'notion' | 'google-docs',
    @Query('q') query = '',
    @Query('limit') limitRaw?: string,
  ) {
    const parsedLimit = Number.parseInt(String(limitRaw || ''), 10);
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;
    return this.integrationsService.searchDocumentSource(user.id, provider, query, limit);
  }

  @Post(':provider/connect-token')
  connectToken(
    @CurrentUser() user: { id: string },
    @Param('provider') provider: string,
    @Body() body: ConnectTokenDto,
  ) {
    return this.integrationsService.connectToken(
      user.id,
      provider,
      body.accessToken,
      body.metadata,
    );
  }

  @Delete(':provider')
  disconnect(
    @CurrentUser() user: { id: string },
    @Param('provider') provider: string,
  ) {
    return this.integrationsService.disconnect(user.id, provider);
  }

  @Get(':provider/viewer')
  viewer(@CurrentUser() user: { id: string }, @Param('provider') provider: string) {
    return this.integrationsService.proxyProjectManager(user.id, provider, '/viewer');
  }

  @Get(':provider/teams')
  teams(
    @CurrentUser() user: { id: string },
    @Param('provider') provider: string,
    @Query('first') first?: string,
  ) {
    const query = first ? `?first=${encodeURIComponent(first)}` : '';
    return this.integrationsService.proxyProjectManager(user.id, provider, `/teams${query}`);
  }

  @Get(':provider/projects')
  projects(
    @CurrentUser() user: { id: string },
    @Param('provider') provider: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') qs.set(key, value);
    }
    return this.integrationsService.proxyProjectManager(
      user.id,
      provider,
      `/projects${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
  }

  @Get(':provider/users')
  users(
    @CurrentUser() user: { id: string },
    @Param('provider') provider: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') qs.set(key, value);
    }
    return this.integrationsService.proxyProjectManager(
      user.id,
      provider,
      `/users${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
  }

  @Get(':provider/sync-summary')
  syncSummary(
    @CurrentUser() user: { id: string },
    @Param('provider') provider: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') qs.set(key, value);
    }
    return this.integrationsService.proxyProjectManager(
      user.id,
      provider,
      `/sync-summary${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
  }

  @Post(':provider/issues')
  createIssue(
    @CurrentUser() user: { id: string },
    @Param('provider') provider: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.integrationsService.proxyProjectManager(
      user.id,
      provider,
      '/issues',
      'POST',
      body,
    );
  }

  // --- Communication proxy endpoints (Gmail) ---

  @Get('communication/:provider/threads')
  listThreads(
    @CurrentUser() user: { id: string },
    @Param('provider') provider: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') qs.set(key, value);
    }
    return this.integrationsService.proxyCommunication(
      user.id,
      provider,
      `/threads${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
  }

  @Get('communication/:provider/threads/:threadId')
  getThread(
    @CurrentUser() user: { id: string },
    @Param('provider') provider: string,
    @Param('threadId') threadId: string,
  ) {
    return this.integrationsService.proxyCommunication(
      user.id,
      provider,
      `/threads/${threadId}`,
    );
  }

  @Get('communication/:provider/search')
  searchMessages(
    @CurrentUser() user: { id: string },
    @Param('provider') provider: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') qs.set(key, value);
    }
    return this.integrationsService.proxyCommunication(
      user.id,
      provider,
      `/search${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
  }

  @Get('communication/:provider/messages/:messageId')
  getEmailMessage(
    @CurrentUser() user: { id: string },
    @Param('provider') provider: string,
    @Param('messageId') messageId: string,
  ) {
    return this.integrationsService.proxyCommunication(
      user.id,
      provider,
      `/messages/${messageId}`,
    );
  }

  @Post('communication/:provider/messages')
  sendEmailMessage(
    @CurrentUser() user: { id: string },
    @Param('provider') provider: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.integrationsService.proxyCommunication(
      user.id,
      provider,
      '/messages',
      'POST',
      body,
    );
  }
}
