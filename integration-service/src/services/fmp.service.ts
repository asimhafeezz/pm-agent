import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type FmpPeriod = 'annual' | 'quarter' | string;

@Injectable()
export class FmpService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    const configuredBaseUrl = this.configService.get<string>('fmp.baseUrl');
    this.baseUrl = (configuredBaseUrl || 'https://financialmodelingprep.com/stable').replace(/\/+$/, '');
    this.apiKey = this.configService.get<string>('fmp.apiKey') || '';
    this.timeoutMs = Number(this.configService.get<string>('fmp.timeoutMs') || 10000);
  }

  async searchName(query: string) {
    return this.request('/search-name', { query });
  }

  async profile(symbol: string) {
    return this.request('/profile', { symbol });
  }

  async incomeStatement(symbol: string) {
    return this.request('/income-statement', { symbol });
  }

  async balanceSheet(symbol: string) {
    return this.request('/balance-sheet-statement', { symbol });
  }

  async cashFlow(symbol: string) {
    return this.request('/cash-flow-statement', { symbol });
  }

  async financialGrowth(symbol: string) {
    return this.request('/financial-growth', { symbol });
  }

  async earnings(symbol: string) {
    return this.request('/earnings', { symbol });
  }

  async earningsCalendar(from?: string, to?: string) {
    const data = await this.request('/earnings-calendar');
    if (!from && !to) {
      return data;
    }

    const fromDate = from ? this.parseDate(from, 'from') : null;
    const toDate = to ? this.parseDate(to, 'to') : null;

    if (!Array.isArray(data)) {
      return data;
    }

    return data.filter((entry) => {
      const entryDate = this.extractCalendarDate(entry);
      if (!entryDate) {
        return false;
      }

      if (fromDate && entryDate < fromDate) {
        return false;
      }

      if (toDate && entryDate > toDate) {
        return false;
      }

      return true;
    });
  }

  async analystEstimates(symbol: string, period: FmpPeriod, page: number, limit: number) {
    return this.request('/analyst-estimates', {
      symbol,
      period,
      page,
      limit,
    });
  }

  async fundamentals(symbol: string) {
    const [incomeStatement, balanceSheet, cashFlow, financialGrowth] = await Promise.all([
      this.incomeStatement(symbol),
      this.balanceSheet(symbol),
      this.cashFlow(symbol),
      this.financialGrowth(symbol),
    ]);

    return {
      symbol,
      incomeStatement,
      balanceSheet,
      cashFlow,
      financialGrowth,
    };
  }

  private extractCalendarDate(entry: Record<string, unknown>): Date | null {
    const dateKeys = ['date', 'earningsDate', 'reportDate', 'epsDate'];
    for (const key of dateKeys) {
      const value = entry[key];
      if (typeof value === 'string' && value.trim()) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }
    return null;
  }

  private parseDate(value: string, label: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ${label} date. Expected YYYY-MM-DD.`);
    }
    return parsed;
  }

  private ensureApiKey() {
    if (!this.apiKey) {
      throw new InternalServerErrorException('FMP_API_KEY is not configured.');
    }
  }

  private async request(path: string, params?: Record<string, string | number>) {
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
        const message = payload?.message || payload?.error || raw || `FMP request failed (${response.status}).`;
        console.error('FMP API error:', { status: response.status, url: url.toString(), message });
        throw new BadGatewayException(message);
      }

      return payload;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      if ((error as Error).name === 'AbortError') {
        throw new ServiceUnavailableException('FMP request timed out.');
      }
      throw new BadGatewayException('FMP request failed.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
