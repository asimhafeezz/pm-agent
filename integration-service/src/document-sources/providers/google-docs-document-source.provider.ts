import { Injectable } from '@nestjs/common';
import { GoogleDocsService } from '../../main-services/google-docs/google-docs.service';
import {
  DocumentSourcePayload,
  DocumentSourceProvider,
  DocumentSourceSearchItem,
} from './document-source-provider.interface';

@Injectable()
export class GoogleDocsDocumentSourceProvider implements DocumentSourceProvider {
  constructor(private readonly googleDocsService: GoogleDocsService) {}

  async fetch(source: string, tokenOverride?: string): Promise<DocumentSourcePayload> {
    return this.googleDocsService.fetchDocument(source, tokenOverride);
  }

  async health(tokenOverride?: string) {
    const configured = this.googleDocsService.isConfigured(tokenOverride);
    return {
      provider: 'google-docs',
      configured,
      reason: configured ? undefined : 'GOOGLE_DOCS_ACCESS_TOKEN is missing',
    };
  }

  async search(query: string, tokenOverride?: string, limit?: number): Promise<DocumentSourceSearchItem[]> {
    const response = await this.googleDocsService.searchDocuments(query, tokenOverride, limit);
    return response.items;
  }
}
