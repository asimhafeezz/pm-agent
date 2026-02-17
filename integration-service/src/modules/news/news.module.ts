import { Module } from '@nestjs/common';
import { NewsDataService } from '../../services/newsdata.service';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';

@Module({
  controllers: [NewsController],
  providers: [NewsService, NewsDataService],
})
export class NewsModule {}
