import { Module } from '@nestjs/common';
import { DocumentSourcesController } from './document-sources.controller';
import { DocumentSourcesService } from './document-sources.service';
import { NotionModule } from '../main-services/notion/notion.module';
import { GoogleDocsModule } from '../main-services/google-docs/google-docs.module';
import { NotionDocumentSourceProvider } from './providers/notion-document-source.provider';
import { GoogleDocsDocumentSourceProvider } from './providers/google-docs-document-source.provider';

@Module({
  imports: [NotionModule, GoogleDocsModule],
  controllers: [DocumentSourcesController],
  providers: [
    DocumentSourcesService,
    NotionDocumentSourceProvider,
    GoogleDocsDocumentSourceProvider,
  ],
})
export class DocumentSourcesModule {}
