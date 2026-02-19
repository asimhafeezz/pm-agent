import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { FetchDocumentSourceDto } from './dto/fetch-document-source.dto';
import { DocumentSourcesService } from './document-sources.service';

@Controller('document-sources')
export class DocumentSourcesController {
  constructor(private readonly documentSourcesService: DocumentSourcesService) {}

  @Get(':provider/health')
  providerHealth(
    @Param('provider') provider: string,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.documentSourcesService.health(provider, providerToken);
  }

  @Post(':provider/fetch')
  fetchFromProvider(
    @Param('provider') provider: string,
    @Body() body: FetchDocumentSourceDto,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    return this.documentSourcesService.fetch(provider, body.source, providerToken);
  }

  @Get(':provider/search')
  searchProviderDocuments(
    @Param('provider') provider: string,
    @Query('q') query = '',
    @Query('limit') limitRaw?: string,
    @Headers('x-provider-token') providerToken?: string,
  ) {
    const parsedLimit = Number.parseInt(String(limitRaw || ''), 10);
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined;
    return this.documentSourcesService.search(provider, query, providerToken, limit);
  }
}
