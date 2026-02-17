import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { InstrumentsService } from './instruments.service';

@Controller('instruments')
export class InstrumentsController {
  constructor(private readonly instrumentsService: InstrumentsService) {}

  @Get('search')
  async search(
    @Query('query') query: string,
    @Query('assetType') assetType?: string,
  ) {
    if (!query) {
      throw new BadRequestException('Query parameter "query" is required');
    }
    return this.instrumentsService.search(query, assetType);
  }

  @Get('resolve')
  async resolve(@Query('symbol') symbol: string) {
    if (!symbol) {
      throw new BadRequestException('Query parameter "symbol" is required');
    }
    return this.instrumentsService.resolve(symbol);
  }
}
