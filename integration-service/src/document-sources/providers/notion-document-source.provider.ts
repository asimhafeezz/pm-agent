import { Injectable } from '@nestjs/common';
import { NotionService } from '../../main-services/notion/notion.service';
import {
  DocumentSourcePayload,
  DocumentSourceProvider,
  DocumentSourceSearchItem,
} from './document-source-provider.interface';

@Injectable()
export class NotionDocumentSourceProvider implements DocumentSourceProvider {
  constructor(private readonly notionService: NotionService) {}

  async fetch(source: string, tokenOverride?: string): Promise<DocumentSourcePayload> {
    return this.notionService.fetchPage(source, tokenOverride);
  }

  async health(tokenOverride?: string) {
    const configured = this.notionService.isConfigured(tokenOverride);
    return {
      provider: 'notion',
      configured,
      reason: configured ? undefined : 'NOTION_API_KEY is missing',
    };
  }

  async search(query: string, tokenOverride?: string, limit?: number): Promise<DocumentSourceSearchItem[]> {
    const response = await this.notionService.searchPages(query, tokenOverride, limit);
    return response.items;
  }
}
