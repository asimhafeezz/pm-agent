import { BadRequestException, Controller, Get, Query, Logger } from '@nestjs/common';
import { BatchDto } from './dto/batch.dto';
import { CurrencyConversionDto } from './dto/currency-conversion.dto';
import { EarliestTimestampDto } from './dto/earliest-timestamp.dto';
import { ExchangeRateDto } from './dto/exchange-rate.dto';
import { ListStocksDto } from './dto/list-stocks.dto';
import { SearchSymbolsDto } from './dto/search-symbols.dto';
import { SymbolDto } from './dto/symbol.dto';
import { TimeSeriesDto } from './dto/time-series.dto';
import { MarketPricesService } from './market-prices.service';

function mapRangeToTimeSeriesConfig(range: TimeSeriesDto['range']) {
  switch (range) {
    case '1D':
      return { interval: '1h', outputsize: 24 };
    case '1W':
      return { interval: '1day', outputsize: 7 };
    case '1M':
      return { interval: '1day', outputsize: 30 };
    case '3M':
      return { interval: '1day', outputsize: 90 };
    case '1Y':
      return { interval: '1day', outputsize: 365 };
    case 'MAX':
      return { interval: '1day', outputsize: 5000 };
    default:
      return null;
  }
}

@Controller('tools/market-prices')
export class MarketPricesController {
  private readonly logger = new Logger(MarketPricesController.name);

  constructor(private readonly marketPricesService: MarketPricesService) {}

  @Get('search-symbols')
  async searchSymbols(@Query() params: SearchSymbolsDto) {
    this.logger.log(
      `API::: integration/tools/market-prices/search-symbols called query=${params.query ?? ''} exchange=${params.exchange ?? ''} country=${params.country ?? ''}`,
    );
    if (!params.query) {
      throw new BadRequestException('query is required.');
    }
    return this.marketPricesService.searchSymbols(params.query, params.exchange, params.country);
  }

  @Get('list-stocks')
  async listStocks(@Query() params: ListStocksDto) {
    this.logger.log(
      `API::: integration/tools/market-prices/list-stocks called exchange=${params.exchange ?? ''}`,
    );
    return this.marketPricesService.listStocks(params.exchange);
  }

  @Get('list-crypto-pairs')
  async listCryptoPairs() {
    this.logger.log('API::: integration/tools/market-prices/list-crypto-pairs called');
    return this.marketPricesService.listCryptoPairs();
  }

  @Get('list-commodity-pairs')
  async listCommodityPairs() {
    this.logger.log('API::: integration/tools/market-prices/list-commodity-pairs called');
    return this.marketPricesService.listCommodityPairs();
  }

  @Get('live-price')
  async getLivePrice(@Query() params: SymbolDto) {
    this.logger.log(`API::: integration/tools/market-prices/live-price called symbol=${params.symbol ?? ''}`);
    if (!params.symbol) {
      throw new BadRequestException('symbol is required.');
    }
    return this.marketPricesService.getLivePrice(params.symbol.toUpperCase());
  }

  @Get('quote')
  async getQuote(@Query() params: SymbolDto) {
    this.logger.log(`API::: integration/tools/market-prices/quote called symbol=${params.symbol ?? ''}`);
    if (!params.symbol) {
      throw new BadRequestException('symbol is required.');
    }
    return this.marketPricesService.getQuote(params.symbol.toUpperCase());
  }

  @Get('time-series')
  async getTimeSeries(@Query() params: TimeSeriesDto) {
    this.logger.log(
      `API::: integration/tools/market-prices/time-series called symbol=${params.symbol ?? ''} interval=${params.interval ?? ''} range=${params.range ?? ''} outputsize=${params.outputsize ?? ''}`,
    );
    if (!params.symbol) {
      throw new BadRequestException('symbol is required.');
    }

    const rangeConfig = params.range ? mapRangeToTimeSeriesConfig(params.range) : null;
    const interval = params.interval || rangeConfig?.interval;
    if (!interval) {
      throw new BadRequestException('interval or range is required.');
    }

    const outputsizeFromParams = params.outputsize ? Number(params.outputsize) : undefined;
    const outputsize = outputsizeFromParams ?? rangeConfig?.outputsize;

    if (
      params.outputsize &&
      (!Number.isInteger(outputsizeFromParams) || outputsizeFromParams <= 0)
    ) {
      throw new BadRequestException('outputsize must be a positive integer.');
    }

    return this.marketPricesService.getTimeSeries(
      params.symbol.toUpperCase(),
      interval,
      outputsize,
      params.start_date,
      params.end_date,
    );
  }

  @Get('earliest-timestamp')
  async getEarliestTimestamp(@Query() params: EarliestTimestampDto) {
    this.logger.log(
      `API::: integration/tools/market-prices/earliest-timestamp called symbol=${params.symbol ?? ''} interval=${params.interval ?? ''}`,
    );
    if (!params.symbol) {
      throw new BadRequestException('symbol is required.');
    }
    if (!params.interval) {
      throw new BadRequestException('interval is required.');
    }
    return this.marketPricesService.getEarliestTimestamp(params.symbol.toUpperCase(), params.interval);
  }

  @Get('batch-price')
  async batchPrice(@Query() params: BatchDto) {
    this.logger.log(
      `API::: integration/tools/market-prices/batch-price called symbols=${params.symbols ?? ''} interval=${params.interval ?? ''} outputsize=${params.outputsize ?? ''}`,
    );
    if (!params.symbols) {
      throw new BadRequestException('symbols is required.');
    }
    const symbols = params.symbols.split(',').map((symbol) => symbol.trim()).filter(Boolean);
    if (symbols.length === 0) {
      throw new BadRequestException('symbols must include at least one symbol.');
    }

    const extraParams: Record<string, string | number> = {};
    if (params.interval) {
      extraParams.interval = params.interval;
    }
    if (params.outputsize) {
      const outputsize = Number(params.outputsize);
      if (!Number.isInteger(outputsize) || outputsize <= 0) {
        throw new BadRequestException('outputsize must be a positive integer.');
      }
      extraParams.outputsize = outputsize;
    }
    if (params.start_date) {
      extraParams.start_date = params.start_date;
    }
    if (params.end_date) {
      extraParams.end_date = params.end_date;
    }

    return this.marketPricesService.batchPrice(symbols.map((symbol) => symbol.toUpperCase()), extraParams);
  }

  @Get('batch-quote')
  async batchQuote(@Query() params: BatchDto) {
    this.logger.log(
      `API::: integration/tools/market-prices/batch-quote called symbols=${params.symbols ?? ''} interval=${params.interval ?? ''} outputsize=${params.outputsize ?? ''}`,
    );
    if (!params.symbols) {
      throw new BadRequestException('symbols is required.');
    }
    const symbols = params.symbols.split(',').map((symbol) => symbol.trim()).filter(Boolean);
    if (symbols.length === 0) {
      throw new BadRequestException('symbols must include at least one symbol.');
    }

    const extraParams: Record<string, string | number> = {};
    if (params.interval) {
      extraParams.interval = params.interval;
    }
    if (params.outputsize) {
      const outputsize = Number(params.outputsize);
      if (!Number.isInteger(outputsize) || outputsize <= 0) {
        throw new BadRequestException('outputsize must be a positive integer.');
      }
      extraParams.outputsize = outputsize;
    }
    if (params.start_date) {
      extraParams.start_date = params.start_date;
    }
    if (params.end_date) {
      extraParams.end_date = params.end_date;
    }

    return this.marketPricesService.batchQuote(symbols.map((symbol) => symbol.toUpperCase()), extraParams);
  }

  @Get('exchange-rate')
  async getExchangeRate(@Query() params: ExchangeRateDto) {
    this.logger.log(`API::: integration/tools/market-prices/exchange-rate called pair=${params.pair ?? ''}`);
    if (!params.pair) {
      throw new BadRequestException('pair is required.');
    }
    return this.marketPricesService.getExchangeRate(params.pair.toUpperCase());
  }

  @Get('convert-currency')
  async convertCurrency(@Query() params: CurrencyConversionDto) {
    this.logger.log(
      `API::: integration/tools/market-prices/convert-currency called amount=${params.amount ?? ''} from=${params.from ?? ''} to=${params.to ?? ''}`,
    );
    if (!params.amount) {
      throw new BadRequestException('amount is required.');
    }
    if (!params.from) {
      throw new BadRequestException('from is required.');
    }
    if (!params.to) {
      throw new BadRequestException('to is required.');
    }

    const amount = Number(params.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amount must be a positive number.');
    }

    return this.marketPricesService.convertCurrency(amount, params.from.toUpperCase(), params.to.toUpperCase());
  }
}
