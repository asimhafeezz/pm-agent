import { Module } from '@nestjs/common';
import { InstrumentsController } from './instruments.controller';
import { InstrumentsService } from './instruments.service';
import { TwelveDataService } from '../../services/twelvedata.service';

@Module({
  controllers: [InstrumentsController],
  providers: [InstrumentsService, TwelveDataService],
  exports: [InstrumentsService],
})
export class InstrumentsModule {}
