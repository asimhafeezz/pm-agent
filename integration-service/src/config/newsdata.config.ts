import { registerAs } from '@nestjs/config';

export const newsDataConfig = registerAs('newsdata', () => ({
  apiKey: process.env.NEWSDATA_API_KEY || '',
  baseUrl: process.env.NEWSDATA_BASE_URL || 'https://newsdata.io/api/1',
  timeoutMs: Number(process.env.NEWSDATA_TIMEOUT_MS || 10000),
}));
