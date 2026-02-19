import { BadRequestException, Injectable } from '@nestjs/common';
import { GoogleDocsService } from '../main-services/google-docs/google-docs.service';
import { LinearService } from '../main-services/linear/linear.service';
import { NotionService } from '../main-services/notion/notion.service';
import { GmailService } from '../main-services/gmail/gmail.service';
import { SlackService } from '../main-services/slack/slack.service';

@Injectable()
export class OAuthService {
  constructor(
    private readonly linearService: LinearService,
    private readonly notionService: NotionService,
    private readonly googleDocsService: GoogleDocsService,
    private readonly gmailService: GmailService,
    private readonly slackService: SlackService,
  ) {}

  authorize(provider: string, redirectUri: string, state: string) {
    const normalized = this.normalizeProvider(provider);
    if (normalized === 'linear') {
      return this.linearService.getAuthorizationUrl(redirectUri, state);
    }
    if (normalized === 'notion') {
      return this.notionService.getAuthorizationUrl(redirectUri, state);
    }
    if (normalized === 'gmail') {
      return this.gmailService.getAuthorizationUrl(redirectUri, state);
    }
    if (normalized === 'slack') {
      return this.slackService.getAuthorizationUrl(redirectUri, state);
    }
    return this.googleDocsService.getAuthorizationUrl(redirectUri, state);
  }

  exchangeCode(provider: string, code: string, redirectUri: string) {
    const normalized = this.normalizeProvider(provider);
    if (normalized === 'linear') {
      return this.linearService.exchangeAuthorizationCode(code, redirectUri);
    }
    if (normalized === 'notion') {
      return this.notionService.exchangeAuthorizationCode(code, redirectUri);
    }
    if (normalized === 'gmail') {
      return this.gmailService.exchangeAuthorizationCode(code, redirectUri);
    }
    if (normalized === 'slack') {
      return this.slackService.exchangeAuthorizationCode(code, redirectUri);
    }
    return this.googleDocsService.exchangeAuthorizationCode(code, redirectUri);
  }

  refresh(provider: string, refreshToken: string) {
    const normalized = this.normalizeProvider(provider);
    if (normalized === 'linear') {
      return this.linearService.refreshAccessToken(refreshToken);
    }
    if (normalized === 'notion') {
      return this.notionService.refreshAccessToken(refreshToken);
    }
    if (normalized === 'gmail') {
      return this.gmailService.refreshAccessToken(refreshToken);
    }
    if (normalized === 'slack') {
      return this.slackService.refreshAccessToken(refreshToken);
    }
    return this.googleDocsService.refreshAccessToken(refreshToken);
  }

  private normalizeProvider(provider: string) {
    const normalized = String(provider || '').toLowerCase();
    if (normalized === 'linear') return 'linear' as const;
    if (normalized === 'notion') return 'notion' as const;
    if (normalized === 'gmail') return 'gmail' as const;
    if (normalized === 'slack') return 'slack' as const;
    if (normalized === 'google-docs' || normalized === 'google_docs' || normalized === 'googledocs') {
      return 'google-docs' as const;
    }

    throw new BadRequestException(
      `Unsupported provider '${provider}'. Supported providers: linear, notion, google-docs, gmail, slack`,
    );
  }
}
