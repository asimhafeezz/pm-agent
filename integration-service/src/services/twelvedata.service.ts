import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TwelveDataService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    const configuredBaseUrl = this.configService.get<string>('twelvedata.baseUrl');
    this.baseUrl = (configuredBaseUrl || 'https://api.twelvedata.com').replace(/\/+$/, '');
    this.apiKey = this.configService.get<string>('twelvedata.apiKey') || '';
    this.timeoutMs = Number(this.configService.get<string>('twelvedata.timeoutMs') || 10000);
  }

  searchSymbols(query: string, exchange?: string, country?: string) {
    return this.request('/symbol_search', { symbol: query, exchange, country });
  }

  listStocks(exchange?: string) {
    return this.request('/stocks', { exchange });
  }

  listCryptoPairs() {
    return this.request('/cryptocurrencies');
  }

  listCommodityPairs() {
    return this.request('/commodities');
  }

  getLivePrice(symbol: string) {
    return this.request('/price', { symbol });
  }

  getQuote(symbol: string) {
    return this.request('/quote', { symbol });
  }

  getTimeSeries(
    symbol: string,
    interval: string,
    outputsize?: number,
    startDate?: string,
    endDate?: string,
  ) {
    return this.request('/time_series', {
      symbol,
      interval,
      outputsize,
      start_date: startDate,
      end_date: endDate,
    });
  }

  getEarliestTimestamp(symbol: string, interval: string) {
    return this.request('/earliest_timestamp', { symbol, interval });
  }

  batchPrice(symbols: string[], params?: Record<string, string | number>) {
    return this.request('/price', { symbol: symbols.join(','), ...(params || {}), format: 'json' });
  }

  batchQuote(symbols: string[], params?: Record<string, string | number>) {
    return this.request('/quote', { symbol: symbols.join(','), ...(params || {}), format: 'json' });
  }

  getExchangeRate(pair: string) {
    return this.request('/exchange_rate', { symbol: pair });
  }

  convertCurrency(amount: number, from: string, to: string) {
    return this.request('/currency_conversion', { amount, from, to });
  }

  private ensureApiKey() {
    if (!this.apiKey) {
      throw new InternalServerErrorException('TWELVEDATA_API_KEY is not configured.');
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
      const response = await (globalThis as any).fetch(url, { signal: controller.signal });
      const raw = await response.text();
      let payload: any = null;
      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = raw;
        }
      }

      if (!response.ok) {
        const message =
          payload?.message || payload?.error || raw || `Twelve Data request failed (${response.status}).`;
        console.error('Twelve Data API error:', { status: response.status, url: url.toString(), message });
        throw new BadGatewayException(message);
      }

      if (payload && payload.status === 'error') {
        throw new BadRequestException(payload.message || 'Twelve Data error response.');
      }
      return payload;
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof BadRequestException) {
        throw error;
      }
      if ((error as Error).name === 'AbortError') {
        throw new ServiceUnavailableException('Twelve Data request timed out.');
      }
      throw new BadGatewayException('Twelve Data request failed.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
