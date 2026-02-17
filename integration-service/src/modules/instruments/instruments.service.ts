import { Injectable } from '@nestjs/common';
import { TwelveDataService } from '../../services/twelvedata.service';
import { HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class InstrumentsService {
  constructor(private readonly twelveDataService: TwelveDataService) {}

  async search(query: string, assetType?: string) {
    try {
      const result = await this.twelveDataService.searchSymbols(query);
      if (!result || !result.data) {
        return [];
      }
      
      let items = result.data;

      // 1. Map to internal format
      let mappedItems = items.map((item: any) => {
          const instrumentType = item.instrument_type || '';
          const exchange = item.exchange || '';
          const symbol = item.symbol || '';
          return {
            symbol: symbol,
            name: item.instrument_name,
            exchange: exchange,
            currency: item.currency,
            country: item.country,
            instrumentType: instrumentType, 
            assetType: this.mapAssetType(instrumentType, exchange, symbol),
          };
      });

      const targetType = (assetType || 'ALL').toUpperCase();

      // 2. Keep platform universe only: US Stocks/ETFs + global Crypto
      mappedItems = mappedItems.filter((item) => {
        const normalizedType = String(item.assetType || '').toUpperCase();
        const isCrypto = normalizedType === 'CRYPTO';
        const isUsStockOrEtf =
          (normalizedType === 'STOCK' || normalizedType === 'ETF') &&
          this.isUsMarket(item.exchange, item.country);

        if (targetType === 'CRYPTO') return isCrypto;
        if (targetType === 'STOCK') return normalizedType === 'STOCK' && isUsStockOrEtf;
        if (targetType === 'ETF') return normalizedType === 'ETF' && isUsStockOrEtf;

        // For ALL/empty and unsupported filters, return only supported trade universe.
        return isCrypto || isUsStockOrEtf;
      });

      // 3. Prioritize and Clean
      // Score items to bring high-quality results to top
      mappedItems.sort((a, b) => {
          return this.calculateScore(b) - this.calculateScore(a);
      });

      // Deduplicate by symbol (keep the highest score one, which is now first due to sort)
      const uniqueItems = [];
      const seenSymbols = new Set();

      for (const item of mappedItems) {
          if (!seenSymbols.has(item.symbol)) {
              uniqueItems.push(item);
              seenSymbols.add(item.symbol);
          }
      }

      // 4. Limit results
      return uniqueItems.slice(0, 15);
    } catch (error) {
      console.error('Error searching instruments:', error);
      throw new HttpException('Failed to search instruments', HttpStatus.BAD_GATEWAY);
    }
  }

  private calculateScore(item: any): number {
      let score = 0;
      const exch = item.exchange ? item.exchange.toUpperCase() : '';
      const country = item.country ? item.country.toUpperCase() : '';
      const type = item.instrumentType ? item.instrumentType.toUpperCase() : '';

      // High priority exchanges
      if (['NASDAQ', 'NYSE', 'AMEX', 'ARCA'].includes(exch)) score += 50;
      if (['LSE', 'TSX', 'XETRA', 'SIX', 'HKEX'].includes(exch)) score += 30;
      
      // Crypto Majors
      if (['COINBASE', 'BINANCE', 'KRAKEN', 'COINBASE PRO'].includes(exch) || exch === 'CC' || exch === 'CRYPTO') score += 40;

      // Country priority (US defaults)
      if (country === 'UNITED STATES' || country === 'USA') score += 20;

      // Type priority
      if (type === 'COMMON STOCK' || type === 'ETF') score += 10;
      if (type === 'DIGITAL CURRENCY') score += 10;

      // Deprioritize leverage/inverse (heuristic)
      if (item.name.includes('3x') || item.name.includes('2x') || item.name.includes('Inverse') || item.name.includes('Bear') || item.name.includes('Bull')) score -= 20;

      // Deprioritize weird exchanges for major symbols
      // (This is hard to do generically without knowing if it's a major symbol, but lower tier exchanges naturally get lower score above)

      return score;
    }

  async resolve(symbol: string) {
    try {
      const quote = await this.twelveDataService.getQuote(symbol);
      
      if (!quote || !quote.symbol) {
        throw new HttpException('Instrument not found', HttpStatus.NOT_FOUND);
      }

      // We might need more info if quote doesn't have type
      // But quote endpoint usually returns: symbol, name, exchange, type, etc.
      
      // If type is missing in quote, we might need to fallback or infer.
      // For now, let's assume quote has enough info or we infer from symbol/exchange.
      
      const assetType = this.mapAssetType(quote.type, quote.exchange, quote.symbol);

      return {
        symbol: quote.symbol,
        name: quote.name,
        exchange: quote.exchange,
        micCode: quote.mic_code,
        currency: quote.currency,
        country: quote.country, // might not be in quote, check docs or response
        instrumentType: quote.type,
        assetType: assetType,
        latestPrice: parseFloat(quote.close) || parseFloat(quote.previous_close) || 0,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error resolving instrument:', error);
      throw new HttpException('Failed to resolve instrument', HttpStatus.BAD_GATEWAY);
    }
  }

  private mapAssetType(instrumentType: string, exchange: string, symbol: string): string {
    if (!instrumentType) {
       // Inference fallback based on exchange and symbol
       if (exchange) {
           const exch = exchange.toUpperCase();
           if (['NASDAQ', 'NYSE', 'AMEX', 'ARCA', 'LSE', 'TSX', 'XETRA', 'SIX', 'HKEX'].includes(exch)) {
               return 'STOCK';
           }
           if (['COINBASE', 'BINANCE', 'KRAKEN', 'KUCOIN', 'OKX', 'CRYPTO', 'CC'].includes(exch)) {
               return 'CRYPTO';
           }
       }
       if (symbol.includes('/') || (symbol.length > 6 && !symbol.includes('.'))) {
           return 'CRYPTO'; // Heuristic
       }
       return 'OTHER';
    }

    const type = instrumentType.toUpperCase();

    if (['COMMON STOCK', 'PREFERRED STOCK', 'REIT', 'DEPOSITARY RECEIPT', 'WARRANT'].includes(type) || type.includes('STOCK')) {
      return 'STOCK';
    }
    if (type === 'ETF' || type.includes('ETF')) {
      return 'ETF';
    }
    if (type === 'FOREX' || type === 'PHYSICAL CURRENCY' || exchange === 'FOREX') {
      return 'FOREX';
    }
    if (type === 'DIGITAL CURRENCY' || type === 'CRYPTOCURRENCY' || exchange === 'CRYPTO') {
      return 'CRYPTO';
    }
    if (type.includes('FUND') || type === 'MUTUAL FUND') {
      return 'FUND';
    }
    if (type.includes('BOND')) {
      return 'BOND';
    }
    if (type.includes('COMMODITY')) {
        return 'COMMODITY';
    }

    return 'OTHER';
  }

  private isUsMarket(exchange?: string, country?: string): boolean {
    const exch = String(exchange || '').toUpperCase();
    const nation = String(country || '').toUpperCase();

    if (nation === 'UNITED STATES' || nation === 'USA' || nation === 'US') {
      return true;
    }

    const usVenues = new Set([
      'NASDAQ',
      'NYSE',
      'NYSE MKT',
      'NYSE ARCA',
      'ARCA',
      'AMEX',
      'BATS',
      'IEX',
      'OTC',
      'OTCBB',
      'PINK',
    ]);
    return usVenues.has(exch);
  }
}
