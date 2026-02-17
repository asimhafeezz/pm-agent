import { Injectable } from '@nestjs/common';
import { TwelveDataService } from '../../services/twelvedata.service';

@Injectable()
export class MarketPricesService {
  constructor(private readonly twelveDataService: TwelveDataService) {}

  searchSymbols(query: string, exchange?: string, country?: string) {
    return this.twelveDataService
      .searchSymbols(query, exchange, country)
      .then((payload) => this.normalizeList(payload));
  }

  listStocks(exchange?: string) {
    return this.twelveDataService.listStocks(exchange).then((payload) => this.normalizeList(payload));
  }

  listCryptoPairs() {
    return this.twelveDataService.listCryptoPairs().then((payload) => this.normalizeList(payload));
  }

  listCommodityPairs() {
    return this.twelveDataService.listCommodityPairs().then((payload) => this.normalizeList(payload));
  }

  getLivePrice(symbol: string) {
    return this.twelveDataService.getLivePrice(symbol);
  }

  getQuote(symbol: string) {
    return this.twelveDataService.getQuote(symbol);
  }

  getTimeSeries(
    symbol: string,
    interval: string,
    outputsize?: number,
    startDate?: string,
    endDate?: string,
  ) {
    return this.twelveDataService.getTimeSeries(symbol, interval, outputsize, startDate, endDate);
  }

  getEarliestTimestamp(symbol: string, interval: string) {
    return this.twelveDataService.getEarliestTimestamp(symbol, interval);
  }

  batchPrice(symbols: string[], params?: Record<string, string | number>) {
    return this.twelveDataService.batchPrice(symbols, params);
  }

  batchQuote(symbols: string[], params?: Record<string, string | number>) {
    return this.twelveDataService.batchQuote(symbols, params);
  }

  getExchangeRate(pair: string) {
    return this.twelveDataService.getExchangeRate(pair);
  }

  convertCurrency(amount: number, from: string, to: string) {
    return this.twelveDataService.convertCurrency(amount, from, to);
  }

  private normalizeList(payload: any) {
    const data = Array.isArray(payload?.data) ? payload.data : [];
    return {
      success: true,
      message: 'Success',
      data,
    };
  }
}
