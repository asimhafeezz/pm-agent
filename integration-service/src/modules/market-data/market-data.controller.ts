import { BadRequestException, Controller, Get, Query, Logger } from '@nestjs/common';
import { AnalystEstimatesDto } from './dto/analyst-estimates.dto';
import { EarningsCalendarDto } from './dto/earnings-calendar.dto';
import { RevenueSeriesDto } from './dto/revenue-series.dto';
import { SearchNameDto } from './dto/search-name.dto';
import { SymbolDto } from './dto/symbol.dto';
import { MarketDataService } from './market-data.service';

@Controller('tools/market-data')
export class MarketDataController {
  private readonly logger = new Logger(MarketDataController.name);

  constructor(private readonly marketDataService: MarketDataService) {}

  @Get('search-name')
  async searchName(@Query() query: SearchNameDto) {
    this.logger.log(
      `API::: integration/tools/market-data/search-name called query=${query.query ?? ''} assetType=${query.assetType ?? ''}`,
    );
    if (!query.query) {
      throw new BadRequestException('query is required.');
    }
    return this.marketDataService.searchName(query.query, query.assetType);
  }

  @Get('profile')
  async profile(@Query() params: SymbolDto) {
    this.logger.log(`API::: integration/tools/market-data/profile called symbol=${params.symbol ?? ''}`);
    if (!params.symbol) {
      throw new BadRequestException('symbol is required.');
    }
    return this.marketDataService.profile(params.symbol.toUpperCase());
  }

  @Get('fundamentals')
  async fundamentals(@Query() params: SymbolDto) {
    this.logger.log(`API::: integration/tools/market-data/fundamentals called symbol=${params.symbol ?? ''}`);
    if (!params.symbol) {
      throw new BadRequestException('symbol is required.');
    }
    return this.marketDataService.fundamentals(params.symbol.toUpperCase());
  }

  @Get('earnings')
  async earnings(@Query() params: SymbolDto) {
    this.logger.log(`API::: integration/tools/market-data/earnings called symbol=${params.symbol ?? ''}`);
    if (!params.symbol) {
      throw new BadRequestException('symbol is required.');
    }
    return this.marketDataService.earnings(params.symbol.toUpperCase());
  }

  @Get('earnings-calendar')
  async earningsCalendar(@Query() params: EarningsCalendarDto) {
    this.logger.log(
      `API::: integration/tools/market-data/earnings-calendar called from=${params.from ?? ''} to=${params.to ?? ''}`,
    );
    return this.marketDataService.earningsCalendar(params.from, params.to);
  }

  @Get('analyst-estimates')
  async analystEstimates(@Query() params: AnalystEstimatesDto) {
    this.logger.log(
      `API::: integration/tools/market-data/analyst-estimates called symbol=${params.symbol ?? ''} period=${params.period ?? ''} page=${params.page ?? ''} limit=${params.limit ?? ''}`,
    );
    if (!params.symbol) {
      throw new BadRequestException('symbol is required.');
    }

    const period = params.period || 'annual';
    const page = params.page ?? '0';
    const limit = params.limit ?? '10';
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);

    if (!Number.isInteger(parsedPage) || parsedPage < 0) {
      throw new BadRequestException('page must be a non-negative integer.');
    }

    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      throw new BadRequestException('limit must be a positive integer.');
    }

    return this.marketDataService.analystEstimates(params.symbol.toUpperCase(), period, parsedPage, parsedLimit);
  }

  @Get('revenue-series')
  async revenueSeries(@Query() params: RevenueSeriesDto) {
    this.logger.log(
      `API::: integration/tools/market-data/revenue-series called symbol=${params.symbol ?? ''} period=${params.period ?? ''} limit=${params.limit ?? ''}`,
    );
    if (!params.symbol) {
      throw new BadRequestException('symbol is required.');
    }

    const period = params.period || 'annual';
    const limit = params.limit ? Number(params.limit) : undefined;
    if (params.limit && (!Number.isInteger(limit) || limit <= 0)) {
      throw new BadRequestException('limit must be a positive integer.');
    }

    return this.marketDataService.revenueSeries(params.symbol.toUpperCase(), period, limit);
  }
}
