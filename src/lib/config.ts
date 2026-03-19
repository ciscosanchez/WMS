/**
 * App configuration — reads from environment variables.
 * USE_MOCK_DATA: When true, pages use hardcoded mock data instead of DB queries.
 * Set to "false" once the database is connected.
 */
export const config = {
  useMockData: process.env.USE_MOCK_DATA === "true",
  useMockAuth: process.env.USE_MOCK_AUTH === "true",
  isProduction: process.env.NODE_ENV === "production",
  dispatchPro: {
    url: process.env.DISPATCH_PRO_URL ?? "http://dispatch:3001",
    apiKey: process.env.DISPATCH_PRO_API_KEY ?? "",
    enabled: !!process.env.DISPATCH_PRO_API_KEY,
  },
} as const;
