import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NewsDataService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    const configuredBaseUrl = this.configService.get<string>('newsdata.baseUrl');
    const rawBaseUrl = (configuredBaseUrl || 'https://newsdata.io/api/1').trim();
    let resolvedBaseUrl = 'https://newsdata.io/api/1';
    try {
      const parsed = new URL(rawBaseUrl);
      const normalizedPath = parsed.pathname.includes('/api/1') ? '/api/1' : '/api/1';
      resolvedBaseUrl = `${parsed.origin}${normalizedPath}`;
    } catch {
      resolvedBaseUrl = 'https://newsdata.io/api/1';
    }
    this.baseUrl = resolvedBaseUrl;
    this.apiKey = this.configService.get<string>('newsdata.apiKey') || '';
    this.timeoutMs = Number(this.configService.get<string>('newsdata.timeoutMs') || 10000);
  }

  latest(params: Record<string, string | number | undefined>) {
    return this.request('/latest', params);
  }

  archive(params: Record<string, string | number | undefined>) {
    return this.request('/archive', params);
  }

  market(params: Record<string, string | number | undefined>) {
    return this.request('/market', params);
  }

  crypto(params: Record<string, string | number | undefined>) {
    return this.request('/crypto', params);
  }

  sources(params: Record<string, string | number | undefined>) {
    return this.request('/sources', params);
  }

  private ensureApiKey() {
    if (!this.apiKey) {
      throw new InternalServerErrorException('NEWSDATA_API_KEY is not configured.');
    }
  }

  private async request(path: string, params?: Record<string, string | number | undefined>) {
    this.ensureApiKey();
    if (typeof (globalThis as any).fetch !== 'function') {
      throw new InternalServerErrorException('Fetch API is not available in this runtime.');
    }

    const normalizedPath = path.replace(/^\/+/, '');
    const url = new URL(normalizedPath, `${this.baseUrl}/`);
    url.searchParams.set('apikey', this.apiKey);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await (globalThis as any).fetch(url, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'fin-agent/1.0',
        },
      });
      const contentType = response.headers.get('content-type') || 'application/json';
      const location = response.headers.get('location') || '';
      const raw = await response.text();
      let payload: any = null;
      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = raw;
        }
      }

      if (response.status >= 300 && response.status < 400) {
        const message = `NewsData redirected (${response.status}). Location: ${location || 'unknown'}.`;
        console.error('NewsData API redirect:', {
          status: response.status,
          url: url.toString(),
          location,
        });
        throw new BadGatewayException(message);
      }

      if (!contentType.includes('application/json')) {
        const message =
          'NewsData returned a non-JSON response. Check NEWSDATA_API_KEY and endpoint access.';
        console.error('NewsData API unexpected content-type:', {
          status: response.status,
          url: url.toString(),
          contentType,
          location,
        });
        throw new BadGatewayException(message);
      }

      if (!response.ok) {
        const message =
          payload?.results?.message ||
          payload?.message ||
          payload?.error ||
          raw ||
          `NewsData request failed (${response.status}).`;
        const code = payload?.results?.code;
        console.error('NewsData API error:', { status: response.status, url: url.toString(), message });
        if (response.status >= 400 && response.status < 500) {
          throw new BadRequestException({
            message,
            code,
            status: response.status,
            invalid_ticker: payload?.results?.invalid_ticker,
          });
        }
        throw new BadGatewayException(message);
      }

      if (payload && payload.status === 'error') {
        throw new BadRequestException(payload.message || 'NewsData error response.');
      }

      return payload;
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof BadRequestException) {
        throw error;
      }
      if ((error as Error).name === 'AbortError') {
        throw new ServiceUnavailableException('NewsData request timed out.');
      }
      throw new BadGatewayException('NewsData request failed.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
