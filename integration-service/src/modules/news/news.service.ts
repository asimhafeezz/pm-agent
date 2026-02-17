import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { NewsDataService } from '../../services/newsdata.service';

@Injectable()
export class NewsService {
  private readonly logger = new Logger(NewsService.name);

  constructor(private readonly newsDataService: NewsDataService) {}

  latest(params: Record<string, string | number | undefined>) {
    return this.newsDataService.latest(params).then((payload) => this.normalizeResponse(payload));
  }

  archive(params: Record<string, string | number | undefined>) {
    return this.newsDataService.archive(params).then((payload) => this.normalizeResponse(payload));
  }

  async market(params: Record<string, string | number | undefined>) {
    try {
      const payload = await this.newsDataService.market(params);
      return this.normalizeResponse(payload);
    } catch (error) {
      if (this.isUnsupportedSymbolError(error) && params.symbol) {
        this.logger.warn(`NewsData rejected market symbol "${params.symbol}". Retrying without symbol filter.`);
        const fallbackPayload = await this.newsDataService.market({
          ...params,
          symbol: undefined,
          q: params.q || String(params.symbol),
        });
        return this.normalizeResponse(fallbackPayload);
      }
      throw error;
    }
  }

  async crypto(params: Record<string, string | number | undefined>) {
    try {
      const payload = await this.newsDataService.crypto(params);
      return this.normalizeResponse(payload);
    } catch (error) {
      if (this.isUnsupportedSymbolError(error) && params.symbol) {
        this.logger.warn(`NewsData rejected crypto symbol "${params.symbol}". Retrying without symbol filter.`);
        const fallbackPayload = await this.newsDataService.crypto({
          ...params,
          symbol: undefined,
          q: params.q || String(params.symbol),
        });
        return this.normalizeResponse(fallbackPayload);
      }
      throw error;
    }
  }

  sources(params: Record<string, string | number | undefined>) {
    return this.newsDataService.sources(params).then((payload) => this.normalizeResponse(payload));
  }

  private normalizeResponse(payload: any) {
    const results = Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload?.sources)
        ? payload.sources
        : [];
    const totalResults =
      typeof payload?.totalResults === 'number' || typeof payload?.totalResults === 'string'
        ? Number(payload.totalResults)
        : results.length;
    const nextPage = payload?.nextPage ?? null;

    return {
      success: true,
      message: 'Success',
      totalResults,
      nextPage,
      data: results,
    };
  }

  private isUnsupportedSymbolError(error: unknown): boolean {
    if (!(error instanceof BadRequestException)) {
      return false;
    }

    const response = error.getResponse() as any;
    const code = response?.code || response?.results?.code;
    const message = String(response?.message || '').toLowerCase();

    return code === 'UnsupportedFilter' || message.includes('symbol paramter is invalid') || message.includes('symbol parameter is invalid');
  }
}
