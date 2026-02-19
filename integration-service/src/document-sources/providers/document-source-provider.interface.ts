export type DocumentSourcePayload = {
  sourceType: 'notion' | 'google_docs';
  sourceId: string;
  title: string;
  text: string;
};

export type DocumentSourceSearchItem = {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
};

export interface DocumentSourceProvider {
  fetch(source: string, tokenOverride?: string): Promise<DocumentSourcePayload>;
  health(tokenOverride?: string): Promise<{ provider: string; configured: boolean; reason?: string }>;
  search?(query: string, tokenOverride?: string, limit?: number): Promise<DocumentSourceSearchItem[]>;
}
