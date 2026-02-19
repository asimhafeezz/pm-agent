import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { requestIntegrationJson } from '../common/helpers';
import {
  IntegrationConnection,
  IntegrationProvider,
} from './entities/integration-connection.entity';
import { OAuthCallbackDto } from './dto/oauth-callback.dto';

type TokenDetails = {
  refreshToken?: string;
  accessTokenExpiresAt?: Date | null;
  tokenType?: string;
  scope?: string;
};

type OAuthStatePayload = jwt.JwtPayload & {
  provider: IntegrationProvider;
  sub: string;
  nonce: string;
};

@Injectable()
export class IntegrationsService {
  private integrationServiceUrl: string;

  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly integrationRepo: Repository<IntegrationConnection>,
    private readonly configService: ConfigService,
  ) {
    this.integrationServiceUrl =
      this.configService.get('INTEGRATION_SERVICE_URL') || 'http://localhost:6001';
  }

  normalizeProvider(provider: string): IntegrationProvider {
    const normalized = provider.toLowerCase();
    if (normalized === IntegrationProvider.LINEAR) return IntegrationProvider.LINEAR;
    if (normalized === IntegrationProvider.NOTION) return IntegrationProvider.NOTION;
    if (normalized === IntegrationProvider.GOOGLE_DOCS || normalized === 'google_docs') {
      return IntegrationProvider.GOOGLE_DOCS;
    }
    if (normalized === IntegrationProvider.GMAIL) return IntegrationProvider.GMAIL;
    if (normalized === IntegrationProvider.SLACK) return IntegrationProvider.SLACK;
    throw new BadRequestException(
      `Unsupported provider '${provider}'. Supported providers: linear, notion, google-docs, gmail, slack`,
    );
  }

  async connectToken(
    userId: string,
    providerInput: string,
    accessToken: string,
    metadata?: Record<string, unknown>,
    tokenDetails?: TokenDetails,
  ) {
    const provider = this.normalizeProvider(providerInput);
    const normalizedAccessToken = String(accessToken || '').trim();
    if (!normalizedAccessToken) {
      throw new BadRequestException('accessToken is required');
    }

    const existing = await this.integrationRepo.findOne({ where: { userId, provider } });
    const accessTokenEnc = this.encrypt(normalizedAccessToken);
    const refreshTokenEnc =
      tokenDetails?.refreshToken && tokenDetails.refreshToken.trim()
        ? this.encrypt(tokenDetails.refreshToken.trim())
        : undefined;

    if (existing) {
      existing.accessTokenEnc = accessTokenEnc;
      existing.isActive = true;
      existing.metadata = metadata
        ? { ...(existing.metadata || {}), ...metadata }
        : existing.metadata;
      if (refreshTokenEnc !== undefined) {
        existing.refreshTokenEnc = refreshTokenEnc;
      }
      if (tokenDetails?.accessTokenExpiresAt !== undefined) {
        existing.accessTokenExpiresAt = tokenDetails.accessTokenExpiresAt;
      }
      if (tokenDetails?.tokenType !== undefined) {
        existing.tokenType = tokenDetails.tokenType || null;
      }
      if (tokenDetails?.scope !== undefined) {
        existing.scope = tokenDetails.scope || null;
      }
      await this.integrationRepo.save(existing);
      return this.toStatus(existing);
    }

    const created = this.integrationRepo.create({
      userId,
      provider,
      accessTokenEnc,
      refreshTokenEnc: refreshTokenEnc || null,
      accessTokenExpiresAt: tokenDetails?.accessTokenExpiresAt || null,
      tokenType: tokenDetails?.tokenType || null,
      scope: tokenDetails?.scope || null,
      isActive: true,
      metadata: metadata || null,
    });
    await this.integrationRepo.save(created);
    return this.toStatus(created);
  }

  async disconnect(userId: string, providerInput: string) {
    const provider = this.normalizeProvider(providerInput);
    const existing = await this.integrationRepo.findOne({ where: { userId, provider } });
    if (!existing) return { disconnected: true };
    await this.integrationRepo.remove(existing);
    return { disconnected: true };
  }

  async listStatuses(userId: string) {
    const all = await this.integrationRepo.find({ where: { userId, isActive: true } });
    const byProvider = new Map(all.map((item) => [item.provider, item]));
    const providers = [
      IntegrationProvider.LINEAR,
      IntegrationProvider.NOTION,
      IntegrationProvider.GOOGLE_DOCS,
      IntegrationProvider.GMAIL,
      IntegrationProvider.SLACK,
    ];
    return providers.map((provider) => {
      const row = byProvider.get(provider);
      return {
        provider,
        connected: Boolean(row),
        metadata: row?.metadata || null,
        updatedAt: row?.updatedAt || null,
      };
    });
  }

  async getStatus(userId: string, providerInput: string) {
    const provider = this.normalizeProvider(providerInput);
    const connection = await this.integrationRepo.findOne({ where: { userId, provider, isActive: true } });
    return {
      provider,
      connected: Boolean(connection),
      metadata: connection?.metadata || null,
      updatedAt: connection?.updatedAt || null,
    };
  }

  async fetchDocumentSource(userId: string, providerInput: 'notion' | 'google-docs', source: string) {
    const provider = this.normalizeProvider(providerInput);
    const token = await this.getValidAccessToken(userId, provider);

    return requestIntegrationJson({
      baseUrl: this.integrationServiceUrl,
      path: `/integration/document-sources/${provider}/fetch`,
      method: 'POST',
      body: { source },
      headers: { 'X-Provider-Token': token },
    });
  }

  async searchDocumentSource(
    userId: string,
    providerInput: 'notion' | 'google-docs',
    query = '',
    limit?: number,
  ) {
    const provider = this.normalizeProvider(providerInput);
    if (provider !== IntegrationProvider.GOOGLE_DOCS && provider !== IntegrationProvider.NOTION) {
      throw new BadRequestException('Document source search currently supports notion and google-docs.');
    }

    const token = await this.getValidAccessToken(userId, provider);
    const qs = new URLSearchParams();
    if (query) qs.set('q', query);
    if (limit && Number.isFinite(limit)) qs.set('limit', String(limit));

    return requestIntegrationJson({
      baseUrl: this.integrationServiceUrl,
      path: `/integration/document-sources/${provider}/search${qs.toString() ? `?${qs.toString()}` : ''}`,
      method: 'GET',
      headers: { 'X-Provider-Token': token },
    });
  }

  async proxyProjectManager(
    userId: string,
    providerInput: string,
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown,
  ) {
    const provider = this.normalizeProvider(providerInput);
    if (provider !== IntegrationProvider.LINEAR) {
      throw new BadRequestException('Project manager proxy currently supports only linear.');
    }

    const token = await this.getValidAccessToken(userId, provider);

    return requestIntegrationJson({
      baseUrl: this.integrationServiceUrl,
      path: `/integration/project-manager/${provider}${path}`,
      method,
      body,
      headers: { 'X-Provider-Token': token },
    });
  }

  async proxyCommunication(
    userId: string,
    providerInput: string,
    path: string,
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown,
  ) {
    const provider = this.normalizeProvider(providerInput);
    if (provider !== IntegrationProvider.GMAIL) {
      throw new BadRequestException('Communication proxy currently supports only gmail.');
    }

    const token = await this.getValidAccessToken(userId, provider);

    return requestIntegrationJson({
      baseUrl: this.integrationServiceUrl,
      path: `/integration/communication/${provider}${path}`,
      method,
      body,
      headers: { 'X-Provider-Token': token },
    });
  }

  async startOAuth(userId: string, providerInput: string, redirectUri: string) {
    const provider = this.normalizeProvider(providerInput);
    const normalizedRedirect = this.normalizeRedirectUri(redirectUri, provider);
    const state = this.createOAuthState(userId, provider);

    const query = new URLSearchParams({
      redirectUri: normalizedRedirect,
      state,
    });
    const raw = await requestIntegrationJson({
      baseUrl: this.integrationServiceUrl,
      path: `/integration/oauth/${provider}/authorize?${query.toString()}`,
      method: 'GET',
    });
    const payload = this.unwrapPayload(raw);
    const authorizationUrl = String(payload.authorizationUrl || '').trim();
    if (!authorizationUrl) {
      throw new BadRequestException('Integration service OAuth authorize response is missing authorizationUrl');
    }
    return {
      provider,
      authorizationUrl,
    };
  }

  async completeOAuth(userId: string, body: OAuthCallbackDto) {
    const statePayload = this.verifyOAuthState(body.state);

    if (statePayload.sub !== userId) {
      throw new BadRequestException('OAuth state does not belong to the current user');
    }

    const providerFromState = this.normalizeProvider(String(statePayload.provider || ''));
    if (body.provider) {
      const explicitProvider = this.normalizeProvider(body.provider);
      if (explicitProvider !== providerFromState) {
        throw new BadRequestException('provider does not match state payload');
      }
    }

    const normalizedRedirect = this.normalizeRedirectUri(body.redirectUri, providerFromState);

    const raw = await requestIntegrationJson({
      baseUrl: this.integrationServiceUrl,
      path: `/integration/oauth/${providerFromState}/token`,
      method: 'POST',
      body: {
        code: body.code,
        redirectUri: normalizedRedirect,
      },
    });
    const payload = this.unwrapPayload(raw);

    const accessToken = String(payload.accessToken || payload.access_token || '').trim();
    if (!accessToken) {
      throw new BadRequestException('OAuth token response is missing accessToken');
    }

    const refreshToken = String(payload.refreshToken || payload.refresh_token || '').trim() || undefined;
    const tokenType = String(payload.tokenType || payload.token_type || '').trim() || undefined;
    const scope = String(payload.scope || '').trim() || undefined;
    const expiresInRaw = payload.expiresIn ?? payload.expires_in;
    const expiresIn = this.parseExpiresIn(expiresInRaw);

    const metadata = this.extractOAuthMetadata(payload);
    return this.connectToken(
      userId,
      providerFromState,
      accessToken,
      metadata,
      {
        refreshToken,
        accessTokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
        tokenType,
        scope,
      },
    );
  }

  private async getValidAccessToken(userId: string, provider: IntegrationProvider) {
    const connection = await this.integrationRepo.findOne({
      where: { userId, provider, isActive: true },
    });
    if (!connection) {
      throw new NotFoundException(`${provider} integration is not connected for this user`);
    }

    const token = this.decrypt(connection.accessTokenEnc);
    if (!connection.accessTokenExpiresAt) {
      return token;
    }

    const willExpireSoon = connection.accessTokenExpiresAt.getTime() <= Date.now() + 60_000;
    if (!willExpireSoon) {
      return token;
    }

    if (!connection.refreshTokenEnc) {
      throw new BadRequestException(
        `${provider} integration token expired and no refresh token is available. Reconnect the integration.`,
      );
    }

    return this.refreshConnectionToken(connection);
  }

  private async refreshConnectionToken(connection: IntegrationConnection) {
    const refreshToken = this.decrypt(connection.refreshTokenEnc || '');
    const raw = await requestIntegrationJson({
      baseUrl: this.integrationServiceUrl,
      path: `/integration/oauth/${connection.provider}/refresh`,
      method: 'POST',
      body: { refreshToken },
    });
    const payload = this.unwrapPayload(raw);

    const accessToken = String(payload.accessToken || payload.access_token || '').trim();
    if (!accessToken) {
      throw new BadRequestException('OAuth refresh response is missing accessToken');
    }

    connection.accessTokenEnc = this.encrypt(accessToken);

    const refreshTokenNext = String(payload.refreshToken || payload.refresh_token || '').trim();
    if (refreshTokenNext) {
      connection.refreshTokenEnc = this.encrypt(refreshTokenNext);
    }

    const expiresInRaw = payload.expiresIn ?? payload.expires_in;
    const expiresIn = this.parseExpiresIn(expiresInRaw);
    connection.accessTokenExpiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    const tokenType = String(payload.tokenType || payload.token_type || '').trim();
    if (tokenType) connection.tokenType = tokenType;

    const scope = String(payload.scope || '').trim();
    if (scope) connection.scope = scope;

    await this.integrationRepo.save(connection);
    return accessToken;
  }

  private toStatus(row: IntegrationConnection) {
    return {
      provider: row.provider,
      connected: row.isActive,
      metadata: row.metadata,
      updatedAt: row.updatedAt,
    };
  }

  private getCipherKey() {
    const secret = this.configService.get<string>('INTEGRATION_TOKEN_SECRET') || 'dev-token-secret';
    return crypto.createHash('sha256').update(secret).digest();
  }

  private getOAuthStateSecret() {
    return (
      this.configService.get<string>('INTEGRATION_OAUTH_STATE_SECRET') ||
      this.configService.get<string>('INTEGRATION_TOKEN_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'dev-oauth-state-secret'
    );
  }

  private createOAuthState(userId: string, provider: IntegrationProvider) {
    return jwt.sign(
      {
        sub: userId,
        provider,
        nonce: crypto.randomBytes(12).toString('hex'),
      },
      this.getOAuthStateSecret(),
      { expiresIn: '10m' },
    );
  }

  private verifyOAuthState(state: string): OAuthStatePayload {
    try {
      const payload = jwt.verify(state, this.getOAuthStateSecret()) as OAuthStatePayload;
      if (!payload?.sub || !payload?.provider) {
        throw new BadRequestException('OAuth state is invalid');
      }
      return payload;
    } catch {
      throw new BadRequestException('OAuth state is invalid or expired');
    }
  }

  private getProviderRedirectOverride(provider?: IntegrationProvider): string {
    if (provider === IntegrationProvider.SLACK) {
      return String(this.configService.get<string>('SLACK_OAUTH_REDIRECT_URI') || '').trim();
    }
    return '';
  }

  private normalizeRedirectUri(redirectUri: string, provider?: IntegrationProvider) {
    const providerOverride = this.getProviderRedirectOverride(provider);
    const value = providerOverride || String(redirectUri || '').trim();
    if (!value) {
      throw new BadRequestException('redirectUri is required');
    }

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new BadRequestException('redirectUri is invalid');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('redirectUri must be http/https');
    }
    const normalized = parsed.toString();

    const allowed = String(
      this.configService.get<string>('INTEGRATION_OAUTH_REDIRECT_URI') ||
      '',
    )
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (providerOverride) {
      allowed.push(providerOverride);
    }

    if (allowed.length > 0 && !allowed.includes(normalized)) {
      throw new BadRequestException('redirectUri is not allowed');
    }

    return normalized;
  }

  private unwrapPayload(raw: unknown): Record<string, unknown> {
    if (
      raw &&
      typeof raw === 'object' &&
      'data' in raw &&
      (raw as Record<string, unknown>).data &&
      typeof (raw as Record<string, unknown>).data === 'object'
    ) {
      return (raw as { data: Record<string, unknown> }).data;
    }
    return (raw as Record<string, unknown>) || {};
  }

  private parseExpiresIn(raw: unknown): number | null {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      return raw;
    }
    const parsed = Number.parseInt(String(raw || ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private extractOAuthMetadata(payload: Record<string, unknown>) {
    const metadata: Record<string, unknown> = {
      oauthConnectedAt: new Date().toISOString(),
    };

    if (payload.metadata && typeof payload.metadata === 'object') {
      Object.assign(metadata, payload.metadata as Record<string, unknown>);
    }

    if (payload.raw && typeof payload.raw === 'object') {
      const raw = payload.raw as Record<string, unknown>;
      for (const key of ['workspace_id', 'workspace_name', 'workspace_icon', 'bot_id']) {
        if (raw[key] !== undefined) {
          metadata[key] = raw[key];
        }
      }
    }

    return metadata;
  }

  private encrypt(plainText: string): string {
    const iv = crypto.randomBytes(12);
    const key = this.getCipherKey();
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
  }

  private decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = String(payload || '').split('.');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new BadRequestException('Stored integration token format is invalid');
    }
    const key = this.getCipherKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  }
}
