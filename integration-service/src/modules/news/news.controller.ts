import { BadRequestException, Controller, Get, Query, Logger } from '@nestjs/common';
import { ArchiveNewsDto } from './dto/archive-news.dto';
import { CryptoNewsDto } from './dto/crypto-news.dto';
import { LatestNewsDto } from './dto/latest-news.dto';
import { MarketNewsDto } from './dto/market-news.dto';
import { SourcesDto } from './dto/sources.dto';
import { NewsService } from './news.service';

@Controller('tools/news')
export class NewsController {
  private readonly logger = new Logger(NewsController.name);

  constructor(private readonly newsService: NewsService) {}

  @Get('latest')
  async latest(@Query() params: LatestNewsDto) {
    this.logger.log(
      `API::: integration/tools/news/latest called q=${params.q ?? ''} country=${params.country ?? ''} language=${params.language ?? ''} category=${params.category ?? ''} size=${params.size ?? ''} page=${params.page ?? ''}`,
    );
    const size = params.size ? Number(params.size) : undefined;
    if (params.size && (!Number.isInteger(size) || size <= 0)) {
      throw new BadRequestException('size must be a positive integer.');
    }

    return this.newsService.latest({
      q: params.q,
      country: params.country,
      language: params.language,
      category: params.category,
      domain: params.domain,
      page: params.page,
      size,
    });
  }

  @Get('archive')
  async archive(@Query() params: ArchiveNewsDto) {
    this.logger.log(
      `API::: integration/tools/news/archive called q=${params.q ?? ''} from_date=${params.from_date ?? ''} to_date=${params.to_date ?? ''} country=${params.country ?? ''} language=${params.language ?? ''} category=${params.category ?? ''} size=${params.size ?? ''} page=${params.page ?? ''}`,
    );
    const size = params.size ? Number(params.size) : undefined;
    if (params.size && (!Number.isInteger(size) || size <= 0)) {
      throw new BadRequestException('size must be a positive integer.');
    }

    return this.newsService.archive({
      q: params.q,
      from_date: params.from_date,
      to_date: params.to_date,
      country: params.country,
      language: params.language,
      category: params.category,
      domain: params.domain,
      page: params.page,
      size,
    });
  }

  @Get('market')
  async market(@Query() params: MarketNewsDto) {
    this.logger.log(
      `API::: integration/tools/news/market called q=${params.q ?? ''} symbol=${params.symbol ?? ''} country=${params.country ?? ''} language=${params.language ?? ''} size=${params.size ?? ''} page=${params.page ?? ''}`,
    );
    const size = params.size ? Number(params.size) : undefined;
    if (params.size && (!Number.isInteger(size) || size <= 0)) {
      throw new BadRequestException('size must be a positive integer.');
    }

    const normalizedSymbol = this.normalizeSymbolParam(params.symbol, 'market');

    return this.newsService.market({
      q: params.q,
      symbol: normalizedSymbol,
      country: params.country,
      language: params.language,
      page: params.page,
      size,
    });
  }

  @Get('crypto')
  async crypto(@Query() params: CryptoNewsDto) {
    this.logger.log(
      `API::: integration/tools/news/crypto called q=${params.q ?? ''} symbol=${params.symbol ?? ''} size=${params.size ?? ''} page=${params.page ?? ''}`,
    );
    const size = params.size ? Number(params.size) : undefined;
    if (params.size && (!Number.isInteger(size) || size <= 0)) {
      throw new BadRequestException('size must be a positive integer.');
    }

    const normalizedSymbol = this.normalizeSymbolParam(params.symbol, 'crypto');

    return this.newsService.crypto({
      q: params.q,
      symbol: normalizedSymbol,
      page: params.page,
      size,
    });
  }

  @Get('sources')
  async sources(@Query() params: SourcesDto) {
    this.logger.log(
      `API::: integration/tools/news/sources called country=${params.country ?? ''} language=${params.language ?? ''} category=${params.category ?? ''}`,
    );
    return this.newsService.sources({
      country: params.country,
      language: params.language,
      category: params.category,
    });
  }

  private normalizeSymbolParam(
    raw: string | undefined,
    mode: 'market' | 'crypto',
  ): string | undefined {
    if (!raw) return undefined;

    const pattern = mode === 'crypto'
      ? /^[A-Z0-9.\-/:]{1,20}$/
      : /^[A-Z0-9.\-:]{1,20}$/;

    const normalized = raw
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    const valid = normalized.filter((item) => pattern.test(item));
    if (valid.length === 0) {
      throw new BadRequestException('symbol must contain a valid ticker format.');
    }

    if (valid.length !== normalized.length) {
      this.logger.warn(
        `Dropped invalid symbol values for ${mode}: ${raw}`,
      );
    }

    return Array.from(new Set(valid)).join(',');
  }
}
