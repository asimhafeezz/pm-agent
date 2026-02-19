import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly apiUrl = 'https://slack.com/api';

  constructor(private readonly configService: ConfigService) {}

  // --- OAuth Methods ---

  getAuthorizationUrl(redirectUri: string, state: string) {
    const clientId = this.configService.get<string>('SLACK_OAUTH_CLIENT_ID');
    if (!clientId) {
      throw new Error('SLACK_OAUTH_CLIENT_ID is not configured');
    }
    const scopes = [
      'chat:write',
      'channels:read',
      'im:write',
      'im:read',
      'users:read',
      'users:read.email',
      'commands',
    ].join(',');

    const params = new URLSearchParams({
      client_id: clientId,
      scope: scopes,
      redirect_uri: redirectUri,
      state,
    });
    return { authorizationUrl: `https://slack.com/oauth/v2/authorize?${params.toString()}` };
  }

  async exchangeAuthorizationCode(code: string, redirectUri: string) {
    const clientId = this.configService.get<string>('SLACK_OAUTH_CLIENT_ID');
    const clientSecret = this.configService.get<string>('SLACK_OAUTH_CLIENT_SECRET');

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const data = (await response.json()) as Record<string, unknown>;
    if (!data.ok) {
      throw new Error(`Slack OAuth error: ${data.error}`);
    }

    return {
      access_token: data.access_token as string,
      token_type: data.token_type as string,
      scope: data.scope as string,
      team: data.team,
      authed_user: data.authed_user,
    };
  }

  async refreshAccessToken(_refreshToken: string) {
    // Slack bot tokens don't expire — they're permanent until revoked.
    // This method exists for interface compatibility.
    throw new Error('Slack bot tokens do not require refresh');
  }

  // --- Slack Web API Methods ---

  async sendMessage(
    channel: string,
    text: string,
    tokenOverride?: string,
    options?: { blocks?: unknown[]; thread_ts?: string },
  ): Promise<Record<string, unknown>> {
    return this.apiCall('chat.postMessage', tokenOverride, {
      channel,
      text,
      ...(options?.blocks ? { blocks: options.blocks } : {}),
      ...(options?.thread_ts ? { thread_ts: options.thread_ts } : {}),
    });
  }

  async listChannels(
    tokenOverride?: string,
    limit = 100,
  ): Promise<Record<string, unknown>> {
    return this.apiCall('conversations.list', tokenOverride, {
      limit: limit.toString(),
      types: 'public_channel,private_channel',
    });
  }

  async openConversation(
    userId: string,
    tokenOverride?: string,
  ): Promise<Record<string, unknown>> {
    return this.apiCall('conversations.open', tokenOverride, {
      users: userId,
    });
  }

  async listUsers(
    tokenOverride?: string,
    limit = 100,
  ): Promise<Record<string, unknown>> {
    return this.apiCall('users.list', tokenOverride, {
      limit: limit.toString(),
    });
  }

  async getUserInfo(
    userId: string,
    tokenOverride?: string,
  ): Promise<Record<string, unknown>> {
    return this.apiCall('users.info', tokenOverride, {
      user: userId,
    });
  }

  async postWebhook(
    webhookUrl: string,
    payload: { text: string; blocks?: unknown[] },
  ): Promise<void> {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status}`);
    }
  }

  // --- Private Helpers ---

  private async apiCall(
    method: string,
    tokenOverride?: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const token = tokenOverride || this.configService.get<string>('SLACK_BOT_TOKEN');
    if (!token) {
      throw new Error('No Slack token available');
    }

    const response = await fetch(`${this.apiUrl}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body || {}),
    });

    const data = (await response.json()) as Record<string, unknown>;
    if (!data.ok) {
      this.logger.error(`Slack API ${method} failed: ${data.error}`);
      throw new Error(`Slack API ${method}: ${data.error}`);
    }

    return data;
  }
}
