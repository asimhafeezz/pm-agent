import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type GoogleDocSearchItem = {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
};

@Injectable()
export class GoogleDocsService {
  constructor(private readonly configService: ConfigService) {}

  getAuthorizationUrl(redirectUri: string, state: string) {
    const clientId = this.getOAuthClientId();
    if (!clientId) {
      throw new BadRequestException('GOOGLE_OAUTH_CLIENT_ID is not configured');
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
      this.configService.get('GOOGLE_OAUTH_SCOPES') ||
      'https://www.googleapis.com/auth/documents.readonly https://www.googleapis.com/auth/drive.readonly'
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
      provider: 'google-docs',
      authorizationUrl: url.toString(),
    };
  }

  async exchangeAuthorizationCode(code: string, redirectUri: string) {
    const clientId = this.getOAuthClientId();
    const clientSecret = this.getOAuthClientSecret();
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Google OAuth is not configured. Missing GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET',
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
        String(payload.error_description || payload.error || 'Google OAuth token exchange failed'),
      );
    }

    const accessToken = String(payload.access_token || '').trim();
    if (!accessToken) {
      throw new BadRequestException('Google OAuth response is missing access_token');
    }

    return {
      provider: 'google-docs' as const,
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
        'Google OAuth is not configured. Missing GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET',
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
        String(payload.error_description || payload.error || 'Google OAuth refresh failed'),
      );
    }

    const accessToken = String(payload.access_token || '').trim();
    if (!accessToken) {
      throw new BadRequestException('Google OAuth refresh is missing access_token');
    }

    return {
      provider: 'google-docs' as const,
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

  async fetchDocument(source: string, tokenOverride?: string) {
    const accessToken = this.getAccessToken(tokenOverride);
    if (!accessToken) {
      throw new BadRequestException('GOOGLE_DOCS_ACCESS_TOKEN is not configured');
    }

    const documentId = this.normalizeGoogleDocumentId(source);
    const googleDoc = await this.fetchGoogleDocument(documentId, accessToken);
    const title = String(googleDoc?.title || '').trim();
    const text = this.extractGoogleDocText(googleDoc);

    if (!text.trim()) {
      throw new BadRequestException('The selected Google Doc has no extractable text');
    }

    return {
      sourceType: 'google_docs' as const,
      sourceId: documentId,
      title: title || `Google Doc ${documentId}`,
      text,
    };
  }

  async searchDocuments(query: string, tokenOverride?: string, limit = 20) {
    const accessToken = this.getAccessToken(tokenOverride);
    if (!accessToken) {
      throw new BadRequestException('GOOGLE_DOCS_ACCESS_TOKEN is not configured');
    }

    const items = await this.searchGoogleDocs(query, accessToken, limit);
    return {
      provider: 'google-docs' as const,
      items,
    };
  }

  isConfigured(tokenOverride?: string) {
    return Boolean(this.getAccessToken(tokenOverride));
  }

  private normalizeGoogleDocumentId(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new BadRequestException('Google doc id/url is required');
    }

    const urlMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    const id = urlMatch?.[1] || trimmed;
    if (!/^[a-zA-Z0-9_-]{20,}$/.test(id)) {
      throw new BadRequestException('Invalid Google document URL or ID');
    }
    return id;
  }

  private getAccessToken(tokenOverride?: string) {
    return (tokenOverride || this.configService.get('GOOGLE_DOCS_ACCESS_TOKEN') || '').trim();
  }

  private getOAuthClientId() {
    return (this.configService.get('GOOGLE_OAUTH_CLIENT_ID') || '').trim();
  }

  private getOAuthClientSecret() {
    return (this.configService.get('GOOGLE_OAUTH_CLIENT_SECRET') || '').trim();
  }

  private async fetchGoogleDocument(
    documentId: string,
    accessToken: string,
  ): Promise<Record<string, any>> {
    const response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new BadRequestException(
          'Google access token is invalid or expired. Reconnect Google Docs integration and try again.',
        );
      }
      if (response.status === 403) {
        throw new BadRequestException(
          'Google denied access to this document (403). Ensure the connected Google account can open the doc and reconnect with Google Docs scopes.',
        );
      }
      throw new BadRequestException(
        `Failed to fetch Google document (${response.status})${bodyText ? `: ${bodyText}` : ''}`,
      );
    }

    return (await response.json()) as Record<string, any>;
  }

  private async searchGoogleDocs(
    query: string,
    accessToken: string,
    limit: number,
  ): Promise<GoogleDocSearchItem[]> {
    const normalizedQuery = String(query || '').trim();
    const pageSize = Math.min(Math.max(limit || 20, 1), 50);
    const qParts = ["mimeType='application/vnd.google-apps.document'", 'trashed=false'];
    if (normalizedQuery) {
      const escaped = normalizedQuery.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      qParts.push(`name contains '${escaped}'`);
    }
    const q = qParts.join(' and ');

    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q);
    url.searchParams.set('orderBy', 'modifiedTime desc');
    url.searchParams.set('pageSize', String(pageSize));
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('fields', 'files(id,name,webViewLink,modifiedTime)');

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      if (response.status === 403) {
        throw new BadRequestException(
          'Google Drive search is not allowed for this token (403). Reconnect Google Docs with drive.readonly scope to search by file name.',
        );
      }
      throw new BadRequestException(
        `Failed to search Google documents (${response.status})${bodyText ? `: ${bodyText}` : ''}`,
      );
    }

    const payload = (await response.json().catch(() => ({}))) as {
      files?: Array<Record<string, unknown>>;
    };
    const files = Array.isArray(payload.files) ? payload.files : [];
    return files
      .map((file) => ({
        id: String(file.id || '').trim(),
        name: String(file.name || '').trim(),
        webViewLink: String(file.webViewLink || '').trim() || undefined,
        modifiedTime: String(file.modifiedTime || '').trim() || undefined,
      }))
      .filter((file) => file.id);
  }

  private extractGoogleDocText(document: Record<string, any>): string {
    const content = Array.isArray(document?.body?.content) ? document.body.content : [];
    const lines: string[] = [];

    const walkElements = (elements: Array<Record<string, any>>) => {
      for (const element of elements) {
        if (element?.paragraph?.elements) {
          const text = (element.paragraph.elements as Array<Record<string, any>>)
            .map((part) => part?.textRun?.content || '')
            .join('')
            .trim();
          if (text) lines.push(text);
        }

        if (element?.table?.tableRows) {
          for (const row of element.table.tableRows as Array<Record<string, any>>) {
            for (const cell of (row?.tableCells || []) as Array<Record<string, any>>) {
              if (Array.isArray(cell?.content)) {
                walkElements(cell.content);
              }
            }
          }
        }

        if (element?.tableOfContents?.content && Array.isArray(element.tableOfContents.content)) {
          walkElements(element.tableOfContents.content);
        }
      }
    };

    walkElements(content);
    return lines.join('\n\n').trim();
  }
}
