import { registerAs } from '@nestjs/config';

export const fmpConfig = registerAs('fmp', () => ({
  apiKey: process.env.FMP_API_KEY || '',
  baseUrl: process.env.FMP_BASE_URL || 'https://financialmodelingprep.com/stable',
  timeoutMs: Number(process.env.FMP_TIMEOUT_MS || 10000),
}));
