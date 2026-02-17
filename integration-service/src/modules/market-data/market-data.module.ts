import { Module } from '@nestjs/common';
import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';
import { FmpService } from '../../services/fmp.service';
import { TwelveDataService } from '../../services/twelvedata.service';

@Module({
  controllers: [MarketDataController],
  providers: [MarketDataService, FmpService, TwelveDataService],
})
export class MarketDataModule {}
