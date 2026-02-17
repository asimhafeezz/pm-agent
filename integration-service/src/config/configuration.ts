export default () => ({
//   database: {
//     mongodb: {
//       uri:
//         process.env.MONGODB_URI ??
//         'mongodb://host.docker.internal:27017/travelz',
//     },
//   },
//   throttler: {
//     limit: +(process.env.THROTTLER_LIMIT ?? 10),
//     ttl: +(process.env.THROTTLER_DURATION_MS ?? 60_000),
//   },
  fmp: {
    baseUrl: process.env.FMP_BASE_URL,
    apiKey: process.env.FMP_API_KEY,
    timeoutMs: +(process.env.FMP_TIMEOUT_MS ?? 30000),
  },
  port: parseInt(process.env.PORT, 10) || 3001,
});
