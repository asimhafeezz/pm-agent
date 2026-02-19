import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type NotionSearchItem = {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
};

@Injectable()
export class NotionService {
  constructor(private readonly configService: ConfigService) {}

  getAuthorizationUrl(redirectUri: string, state: string) {
    const clientId = this.getOAuthClientId();
    if (!clientId) {
      throw new BadRequestException('NOTION_OAUTH_CLIENT_ID is not configured');
    }
    if (!redirectUri?.trim()) {
      throw new BadRequestException('redirectUri is required');
    }
    if (!state?.trim()) {
      throw new BadRequestException('state is required');
    }

    const url = new URL(
      (this.configService.get('NOTION_OAUTH_AUTHORIZE_URL') ||
        'https://api.notion.com/v1/oauth/authorize') as string,
    );
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('owner', 'user');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    return {
      provider: 'notion',
      authorizationUrl: url.toString(),
    };
  }

  async exchangeAuthorizationCode(code: string, redirectUri: string) {
    const clientId = this.getOAuthClientId();
    const clientSecret = this.getOAuthClientSecret();
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Notion OAuth is not configured. Missing NOTION_OAUTH_CLIENT_ID/NOTION_OAUTH_CLIENT_SECRET',
      );
    }

    const tokenUrl = (this.configService.get('NOTION_OAUTH_TOKEN_URL') ||
      'https://api.notion.com/v1/oauth/token') as string;
    const auth = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new BadRequestException(
        String(payload.error_description || payload.error || 'Notion OAuth token exchange failed'),
      );
    }

    const accessToken = String(payload.access_token || '').trim();
    if (!accessToken) {
      throw new BadRequestException('Notion OAuth response is missing access_token');
    }

    return {
      provider: 'notion' as const,
      accessToken,
      refreshToken: String(payload.refresh_token || '').trim() || undefined,
      tokenType: String(payload.token_type || '').trim() || undefined,
      scope: String(payload.scope || '').trim() || undefined,
      expiresIn:
        typeof payload.expires_in === 'number'
          ? payload.expires_in
          : Number.parseInt(String(payload.expires_in || ''), 10) || undefined,
      metadata: {
        workspaceId: payload.workspace_id || null,
        workspaceName: payload.workspace_name || null,
        workspaceIcon: payload.workspace_icon || null,
        owner: payload.owner || null,
      },
      raw: payload,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const clientId = this.getOAuthClientId();
    const clientSecret = this.getOAuthClientSecret();
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Notion OAuth is not configured. Missing NOTION_OAUTH_CLIENT_ID/NOTION_OAUTH_CLIENT_SECRET',
      );
    }
    if (!refreshToken?.trim()) {
      throw new BadRequestException('refreshToken is required');
    }

    const tokenUrl = (this.configService.get('NOTION_OAUTH_TOKEN_URL') ||
      'https://api.notion.com/v1/oauth/token') as string;
    const auth = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new BadRequestException(
        String(payload.error_description || payload.error || 'Notion OAuth refresh failed'),
      );
    }

    const accessToken = String(payload.access_token || '').trim();
    if (!accessToken) {
      throw new BadRequestException('Notion OAuth refresh is missing access_token');
    }

    return {
      provider: 'notion' as const,
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

  async fetchPage(source: string, tokenOverride?: string) {
    const notionApiKey = this.getApiKey(tokenOverride);
    const notionVersion = this.getNotionVersion();
    if (!notionApiKey) {
      throw new BadRequestException('NOTION_API_KEY is not configured');
    }

    const pageId = this.normalizeNotionPageId(source);
    const [title, text] = await Promise.all([
      this.fetchNotionTitle(pageId, notionApiKey, notionVersion),
      this.fetchNotionPageText(pageId, notionApiKey, notionVersion),
    ]);

    if (!text.trim()) {
      throw new BadRequestException('The selected Notion page has no extractable text');
    }

    return {
      sourceType: 'notion' as const,
      sourceId: pageId,
      title: title || `Notion ${pageId}`,
      text,
    };
  }

  async searchPages(query: string, tokenOverride?: string, limit = 20) {
    const notionApiKey = this.getApiKey(tokenOverride);
    const notionVersion = this.getNotionVersion();
    if (!notionApiKey) {
      throw new BadRequestException('NOTION_API_KEY is not configured');
    }

    const pageSize = Math.min(Math.max(limit || 20, 1), 100);
    const response = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${notionApiKey}`,
        'Notion-Version': notionVersion,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: String(query || '').trim(),
        filter: { property: 'object', value: 'page' },
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
        page_size: pageSize,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new BadRequestException(
        `Failed to search Notion pages (${response.status}): ${JSON.stringify(error)}`,
      );
    }

    const payload = (await response.json().catch(() => ({}))) as {
      results?: Array<Record<string, unknown>>;
    };
    const results = Array.isArray(payload.results) ? payload.results : [];
    const items: NotionSearchItem[] = results.map((page) => {
      const id = String(page.id || '').trim();
      const webViewLink = String((page.url as string) || '').trim() || undefined;
      const modifiedTime = String((page.last_edited_time as string) || '').trim() || undefined;
      const properties = (page.properties as Record<string, any>) || {};

      let name = '';
      for (const key of Object.keys(properties)) {
        const prop = properties[key];
        if (prop?.type === 'title' && Array.isArray(prop?.title)) {
          name = prop.title.map((t: any) => t?.plain_text || '').join('').trim();
          if (name) break;
        }
      }

      if (!name) {
        name = id;
      }

      return {
        id,
        name,
        webViewLink,
        modifiedTime,
      };
    });

    return {
      provider: 'notion' as const,
      items: items.filter((item) => item.id),
    };
  }

  isConfigured(tokenOverride?: string) {
    return Boolean(this.getApiKey(tokenOverride));
  }

  private normalizeNotionPageId(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new BadRequestException('Notion page id/url is required');
    }
    const noHyphen = trimmed.replace(/-/g, '');
    const idMatch = noHyphen.match(/[0-9a-fA-F]{32}/);
    if (!idMatch) {
      throw new BadRequestException('Invalid Notion page URL or ID');
    }
    const raw = idMatch[0].toLowerCase();
    return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
  }

  private getApiKey(tokenOverride?: string) {
    return (tokenOverride || this.configService.get('NOTION_API_KEY') || '').trim();
  }

  private getOAuthClientId() {
    return (this.configService.get('NOTION_OAUTH_CLIENT_ID') || '').trim();
  }

  private getOAuthClientSecret() {
    return (this.configService.get('NOTION_OAUTH_CLIENT_SECRET') || '').trim();
  }

  private getNotionVersion() {
    return (this.configService.get('NOTION_API_VERSION') || '2022-06-28').trim();
  }

  private async fetchNotionTitle(
    pageId: string,
    notionApiKey: string,
    notionVersion: string,
  ): Promise<string> {
    const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: {
        Authorization: `Bearer ${notionApiKey}`,
        'Notion-Version': notionVersion,
      },
    });

    if (!response.ok) {
      throw new BadRequestException(`Failed to fetch Notion page metadata (${response.status})`);
    }

    const page = (await response.json()) as Record<string, unknown>;
    const properties = (page?.properties as Record<string, any>) || {};
    for (const key of Object.keys(properties)) {
      const prop = properties[key];
      if (prop?.type === 'title' && Array.isArray(prop?.title)) {
        return prop.title.map((t: any) => t?.plain_text || '').join('').trim();
      }
    }
    return '';
  }

  private async fetchNotionPageText(
    pageId: string,
    notionApiKey: string,
    notionVersion: string,
  ): Promise<string> {
    const lines = await this.fetchNotionBlockChildren(pageId, notionApiKey, notionVersion);
    return lines.join('\n').trim();
  }

  private async fetchNotionBlockChildren(
    blockId: string,
    notionApiKey: string,
    notionVersion: string,
  ): Promise<string[]> {
    const lines: string[] = [];
    let cursor: string | null = null;

    while (true) {
      const url = new URL(`https://api.notion.com/v1/blocks/${blockId}/children`);
      url.searchParams.set('page_size', '100');
      if (cursor) {
        url.searchParams.set('start_cursor', cursor);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${notionApiKey}`,
          'Notion-Version': notionVersion,
        },
      });
      if (!response.ok) {
        throw new BadRequestException(`Failed to fetch Notion blocks (${response.status})`);
      }

      const payload = (await response.json()) as Record<string, any>;
      const results = Array.isArray(payload?.results) ? payload.results : [];
      for (const block of results) {
        const line = this.extractNotionBlockText(block);
        if (line) {
          lines.push(line);
        }
        if (block?.has_children && block?.id) {
          const childLines = await this.fetchNotionBlockChildren(
            block.id,
            notionApiKey,
            notionVersion,
          );
          lines.push(...childLines);
        }
      }

      if (!payload?.has_more) {
        break;
      }
      cursor = payload?.next_cursor || null;
      if (!cursor) {
        break;
      }
    }

    return lines;
  }

  async createPage(
    parentId: string,
    title: string,
    content: string,
    tokenOverride?: string,
  ) {
    const notionApiKey = this.getApiKey(tokenOverride);
    const notionVersion = this.getNotionVersion();
    if (!notionApiKey) {
      throw new BadRequestException('NOTION_API_KEY is not configured');
    }

    const blocks = this.textToNotionBlocks(content);

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${notionApiKey}`,
        'Notion-Version': notionVersion,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { page_id: parentId },
        properties: {
          title: {
            title: [{ text: { content: title } }],
          },
        },
        children: blocks,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new BadRequestException(
        `Failed to create Notion page (${response.status}): ${JSON.stringify(error)}`,
      );
    }

    return response.json();
  }

  async updatePage(
    pageId: string,
    properties: Record<string, unknown>,
    tokenOverride?: string,
  ) {
    const notionApiKey = this.getApiKey(tokenOverride);
    const notionVersion = this.getNotionVersion();
    if (!notionApiKey) {
      throw new BadRequestException('NOTION_API_KEY is not configured');
    }

    const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${notionApiKey}`,
        'Notion-Version': notionVersion,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ properties }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new BadRequestException(
        `Failed to update Notion page (${response.status}): ${JSON.stringify(error)}`,
      );
    }

    return response.json();
  }

  async appendBlocks(
    pageId: string,
    content: string,
    tokenOverride?: string,
  ) {
    const notionApiKey = this.getApiKey(tokenOverride);
    const notionVersion = this.getNotionVersion();
    if (!notionApiKey) {
      throw new BadRequestException('NOTION_API_KEY is not configured');
    }

    const blocks = this.textToNotionBlocks(content);

    const response = await fetch(
      `https://api.notion.com/v1/blocks/${pageId}/children`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${notionApiKey}`,
          'Notion-Version': notionVersion,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ children: blocks }),
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new BadRequestException(
        `Failed to append blocks to Notion page (${response.status}): ${JSON.stringify(error)}`,
      );
    }

    return response.json();
  }

  private textToNotionBlocks(content: string): Array<Record<string, unknown>> {
    const paragraphs = content.split('\n\n').filter((p) => p.trim());
    return paragraphs.map((paragraph) => ({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: paragraph.trim() },
          },
        ],
      },
    }));
  }

  private extractNotionBlockText(block: Record<string, any>): string {
    const type = block?.type;
    if (!type) return '';

    if (type === 'child_page') {
      return String(block?.child_page?.title || '').trim();
    }

    const data = block?.[type];
    if (!data) return '';

    if (Array.isArray(data?.rich_text)) {
      return data.rich_text.map((rt: any) => rt?.plain_text || '').join('').trim();
    }

    if (Array.isArray(data?.text)) {
      return data.text.map((rt: any) => rt?.plain_text || '').join('').trim();
    }

    return '';
  }
}
