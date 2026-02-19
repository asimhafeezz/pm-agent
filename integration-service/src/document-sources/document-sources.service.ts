import { BadRequestException, Injectable } from '@nestjs/common';
import { GoogleDocsDocumentSourceProvider } from './providers/google-docs-document-source.provider';
import {
  DocumentSourcePayload,
  DocumentSourceProvider,
} from './providers/document-source-provider.interface';
import { NotionDocumentSourceProvider } from './providers/notion-document-source.provider';

@Injectable()
export class DocumentSourcesService {
  constructor(
    private readonly notionProvider: NotionDocumentSourceProvider,
    private readonly googleDocsProvider: GoogleDocsDocumentSourceProvider,
  ) {}

  private resolveProvider(provider: string): DocumentSourceProvider {
    const normalized = provider.toLowerCase();
    if (normalized === 'notion') {
      return this.notionProvider;
    }
    if (normalized === 'google-docs' || normalized === 'google_docs' || normalized === 'googledocs') {
      return this.googleDocsProvider;
    }
    throw new BadRequestException(
      `Unsupported provider '${provider}'. Supported providers: notion, google-docs`,
    );
  }

  async fetch(provider: string, source: string, tokenOverride?: string): Promise<DocumentSourcePayload> {
    return this.resolveProvider(provider).fetch(source, tokenOverride);
  }

  async health(provider: string, tokenOverride?: string) {
    return this.resolveProvider(provider).health(tokenOverride);
  }

  async search(provider: string, query: string, tokenOverride?: string, limit?: number) {
    const sourceProvider = this.resolveProvider(provider);
    if (!sourceProvider.search) {
      throw new BadRequestException(`Provider '${provider}' does not support search`);
    }
    const items = await sourceProvider.search(query, tokenOverride, limit);
    return {
      provider,
      items,
    };
  }
}
