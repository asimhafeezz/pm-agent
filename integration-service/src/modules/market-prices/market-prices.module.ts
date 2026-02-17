import { Module } from '@nestjs/common';
import { TwelveDataService } from '../../services/twelvedata.service';
import { MarketPricesController } from './market-prices.controller';
import { MarketPricesService } from './market-prices.service';

@Module({
  controllers: [MarketPricesController],
  providers: [MarketPricesService, TwelveDataService],
})
export class MarketPricesModule {}
