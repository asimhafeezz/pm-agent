import { Injectable } from '@nestjs/common';
import { FmpService, FmpPeriod } from '../../services/fmp.service';
import { TwelveDataService } from '../../services/twelvedata.service';

@Injectable()
export class MarketDataService {
  constructor(
    private readonly fmpService: FmpService,
    private readonly twelveDataService: TwelveDataService,
  ) {}

  async searchName(query: string, assetType?: string) {
    const results = await this.twelveDataService.searchSymbols(query);
    if (!results || !results.data || !Array.isArray(results.data)) {
      return [];
    }
    
    // Map to a common format
    let data = results.data;

    // Filter by asset type if provided
    if (assetType) {
      const type = assetType.toLowerCase();
      data = data.filter((item: any) => {
        const itemType = (item.instrument_type || '').toLowerCase();
        // Asset types from UI: "Stock", "ETF", "Crypto", "Bond", "Other"
        if (type === 'stock') return itemType === 'common stock' || itemType === 'preferred stock' || itemType === 'stock';
        if (type === 'etf') return itemType === 'etf' || itemType === 'etn';
        if (type === 'crypto') return itemType === 'digital currency' || itemType === 'cryptocurrency';
        if (type === 'bond') return itemType.includes('bond');
        return true; 
      });
    }

    return data.map((item: any) => ({
      symbol: item.symbol,
      name: item.instrument_name || item.instrument_type, // Twelve Data search result structure
      currency: item.currency,
      stockExchange: item.exchange,
      exchangeShortName: item.mic_code,
    }));
  }

  profile(symbol: string) {
    return this.fmpService.profile(symbol);
  }

  incomeStatement(symbol: string) {
    return this.fmpService.incomeStatement(symbol);
  }

  balanceSheet(symbol: string) {
    return this.fmpService.balanceSheet(symbol);
  }

  cashFlow(symbol: string) {
    return this.fmpService.cashFlow(symbol);
  }

  financialGrowth(symbol: string) {
    return this.fmpService.financialGrowth(symbol);
  }

  earnings(symbol: string) {
    return this.fmpService.earnings(symbol);
  }

  earningsCalendar(from?: string, to?: string) {
    return this.fmpService.earningsCalendar(from, to);
  }

  analystEstimates(symbol: string, period: FmpPeriod, page: number, limit: number) {
    return this.fmpService.analystEstimates(symbol, period, page, limit);
  }

  fundamentals(symbol: string) {
    return this.fmpService.fundamentals(symbol);
  }

  async revenueSeries(symbol: string, period: 'annual' | 'quarter' = 'annual', limit?: number) {
    const incomeStatement = await this.fmpService.incomeStatement(symbol);

    if (!Array.isArray(incomeStatement)) {
      return {
        symbol,
        period,
        currency: null,
        data: [],
        asOf: new Date().toISOString(),
      };
    }

    const normalized = incomeStatement
      .map((item: any) => {
        const date = item?.date || item?.fillingDate || item?.acceptedDate || null;
        const revenueRaw =
          item?.revenue ??
          item?.totalRevenue ??
          item?.revenueUSD ??
          null;
        const revenue = Number(revenueRaw);
        const currency = item?.reportedCurrency || item?.currency || null;
        const fiscalPeriod = item?.period || item?.fiscalPeriod || null;

        if (!date || !Number.isFinite(revenue)) {
          return null;
        }

        return {
          date,
          revenue,
          currency,
          fiscalPeriod,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => (String(a.date) > String(b.date) ? 1 : -1));

    const sliced = typeof limit === 'number' ? normalized.slice(-limit) : normalized;
    const currency = sliced.find((item: any) => item?.currency)?.currency || null;

    return {
      symbol,
      period,
      currency,
      data: sliced.map((item: any) => ({
        date: item.date,
        revenue: item.revenue,
        fiscalPeriod: item.fiscalPeriod,
      })),
      asOf: new Date().toISOString(),
    };
  }
}
