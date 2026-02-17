import { registerAs } from '@nestjs/config';

export const twelveDataConfig = registerAs('twelvedata', () => ({
  apiKey: process.env.TWELVEDATA_API_KEY || '',
  baseUrl: process.env.TWELVEDATA_BASE_URL || 'https://api.twelvedata.com',
  timeoutMs: Number(process.env.TWELVEDATA_TIMEOUT_MS || 10000),
}));
