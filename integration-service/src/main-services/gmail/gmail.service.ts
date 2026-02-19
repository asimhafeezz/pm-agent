import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  private readonly gmailApiUrl = 'https://gmail.googleapis.com/gmail/v1/users/me';

  constructor(private readonly configService: ConfigService) {}

  getAuthorizationUrl(redirectUri: string, state: string) {
    const clientId = this.getOAuthClientId();
    if (!clientId) {
      throw new BadRequestException('GMAIL_OAUTH_CLIENT_ID is not configured');
    }
    if (!redirectUri?.trim()) {
      throw new BadRequestException('redirectUri is required');
    }
    if (!state?.trim()) {
      throw new BadRequestException('state is required');
    }

    const authorizeUrl = (this.configService.get('GOOGLE_OAUTH_AUTHORIZE_URL') ||
      'https://accounts.google.com/o/oauth2/v2/auth') as string;
    const scopes = (
      this.configService.get('GMAIL_OAUTH_SCOPES') ||
      'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify'
    ) as string;

    const url = new URL(authorizeUrl);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', scopes);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);

    return {
      provider: 'gmail',
      authorizationUrl: url.toString(),
    };
  }

  async exchangeAuthorizationCode(code: string, redirectUri: string) {
    const clientId = this.getOAuthClientId();
    const clientSecret = this.getOAuthClientSecret();
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Gmail OAuth is not configured. Missing GMAIL_OAUTH_CLIENT_ID/GMAIL_OAUTH_CLIENT_SECRET',
      );
    }

    const tokenUrl = (this.configService.get('GOOGLE_OAUTH_TOKEN_URL') ||
      'https://oauth2.googleapis.com/token') as string;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new BadRequestException(
        String(payload.error_description || payload.error || 'Gmail OAuth token exchange failed'),
      );
    }

    const accessToken = String(payload.access_token || '').trim();
    if (!accessToken) {
      throw new BadRequestException('Gmail OAuth response is missing access_token');
    }

    return {
      provider: 'gmail' as const,
      accessToken,
      refreshToken: String(payload.refresh_token || '').trim() || undefined,
      tokenType: String(payload.token_type || '').trim() || undefined,
      scope: String(payload.scope || '').trim() || undefined,
      expiresIn:
        typeof payload.expires_in === 'number'
          ? payload.expires_in
          : Number.parseInt(String(payload.expires_in || ''), 10) || undefined,
      raw: payload,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const clientId = this.getOAuthClientId();
    const clientSecret = this.getOAuthClientSecret();
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Gmail OAuth is not configured. Missing GMAIL_OAUTH_CLIENT_ID/GMAIL_OAUTH_CLIENT_SECRET',
      );
    }
    if (!refreshToken?.trim()) {
      throw new BadRequestException('refreshToken is required');
    }

    const tokenUrl = (this.configService.get('GOOGLE_OAUTH_TOKEN_URL') ||
      'https://oauth2.googleapis.com/token') as string;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new BadRequestException(
        String(payload.error_description || payload.error || 'Gmail OAuth refresh failed'),
      );
    }

    const accessToken = String(payload.access_token || '').trim();
    if (!accessToken) {
      throw new BadRequestException('Gmail OAuth refresh is missing access_token');
    }

    return {
      provider: 'gmail' as const,
      accessToken,
      refreshToken: String(payload.refresh_token || '').trim() || undefined,
      tokenType: String(payload.token_type || '').trim() || undefined,
      scope: String(payload.scope || '').trim() || undefined,
      expiresIn:
        typeof payload.expires_in === 'number'
          ? payload.expires_in
          : Number.parseInt(String(payload.expires_in || ''), 10) || undefined,
      raw: payload,
    };
  }

  async listThreads(query?: string, maxResults = 20, tokenOverride?: string) {
    const accessToken = this.getAccessToken(tokenOverride);
    const url = new URL(`${this.gmailApiUrl}/threads`);
    if (query) url.searchParams.set('q', query);
    url.searchParams.set('maxResults', String(maxResults));

    const response = await this.fetchGmail(url.toString(), accessToken);
    return response;
  }

  async getThread(threadId: string, tokenOverride?: string) {
    const accessToken = this.getAccessToken(tokenOverride);
    const url = `${this.gmailApiUrl}/threads/${threadId}?format=full`;
    const response = await this.fetchGmail(url, accessToken);
    return this.parseThread(response);
  }

  async listMessages(query?: string, maxResults = 20, tokenOverride?: string) {
    const accessToken = this.getAccessToken(tokenOverride);
    const url = new URL(`${this.gmailApiUrl}/messages`);
    if (query) url.searchParams.set('q', query);
    url.searchParams.set('maxResults', String(maxResults));

    const response = await this.fetchGmail(url.toString(), accessToken);
    return response;
  }

  async getMessage(messageId: string, tokenOverride?: string) {
    const accessToken = this.getAccessToken(tokenOverride);
    const url = `${this.gmailApiUrl}/messages/${messageId}?format=full`;
    const response = await this.fetchGmail(url, accessToken);
    return this.parseMessage(response);
  }

  async searchMessages(query: string, maxResults = 20, tokenOverride?: string) {
    return this.listMessages(query, maxResults, tokenOverride);
  }

  async sendMessage(
    input: { to: string; subject: string; body: string; threadId?: string },
    tokenOverride?: string,
  ) {
    const accessToken = this.getAccessToken(tokenOverride);
    const rawMessage = this.buildRawMessage(input.to, input.subject, input.body, input.threadId);

    const response = await fetch(`${this.gmailApiUrl}/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawMessage, threadId: input.threadId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new BadRequestException(
        `Failed to send Gmail message (${response.status}): ${JSON.stringify(error)}`,
      );
    }

    return response.json();
  }

  isConfigured(tokenOverride?: string) {
    return Boolean(this.getAccessToken(tokenOverride));
  }

  private async fetchGmail(url: string, accessToken: string): Promise<Record<string, any>> {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new BadRequestException(`Gmail API request failed (${response.status})`);
    }

    return (await response.json()) as Record<string, any>;
  }

  private parseThread(thread: Record<string, any>) {
    const messages = Array.isArray(thread?.messages) ? thread.messages : [];
    return {
      id: thread.id,
      historyId: thread.historyId,
      messages: messages.map((msg: Record<string, any>) => this.parseMessage(msg)),
    };
  }

  private parseMessage(msg: Record<string, any>) {
    const headers = Array.isArray(msg?.payload?.headers) ? msg.payload.headers : [];
    const getHeader = (name: string) =>
      headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      id: msg.id,
      threadId: msg.threadId,
      labelIds: msg.labelIds || [],
      snippet: msg.snippet || '',
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      body: this.extractBody(msg?.payload),
      internalDate: msg.internalDate,
    };
  }

  private extractBody(payload: Record<string, any> | undefined): string {
    if (!payload) return '';

    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
    }

    const parts = Array.isArray(payload.parts) ? payload.parts : [];
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
    }

    for (const part of parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
    }

    for (const part of parts) {
      if (Array.isArray(part.parts)) {
        const nested = this.extractBody(part);
        if (nested) return nested;
      }
    }

    return '';
  }

  private buildRawMessage(to: string, subject: string, body: string, threadId?: string): string {
    const lines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body,
    ];
    const raw = lines.join('\r\n');
    return Buffer.from(raw, 'utf-8').toString('base64url');
  }

  private getAccessToken(tokenOverride?: string) {
    const token = (tokenOverride || this.configService.get('GMAIL_ACCESS_TOKEN') || '').trim();
    if (!token) {
      throw new BadRequestException('Gmail access token is not available');
    }
    return token;
  }

  private getOAuthClientId() {
    return (this.configService.get('GMAIL_OAUTH_CLIENT_ID') ||
      this.configService.get('GOOGLE_OAUTH_CLIENT_ID') || '').trim();
  }

  private getOAuthClientSecret() {
    return (this.configService.get('GMAIL_OAUTH_CLIENT_SECRET') ||
      this.configService.get('GOOGLE_OAUTH_CLIENT_SECRET') || '').trim();
  }
}
