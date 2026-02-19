import { Global, Module } from '@nestjs/common';
import { NotionService } from './notion.service';

@Global()
@Module({
  providers: [NotionService],
  exports: [NotionService],
})
export class NotionModule {}

