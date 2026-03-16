/**
 * App configuration — reads from environment variables.
 * USE_MOCK_DATA: When true, pages use hardcoded mock data instead of DB queries.
 * Set to "false" once the database is connected.
 */
export const config = {
  useMockData: process.env.USE_MOCK_DATA !== "false",
  isProduction: process.env.NODE_ENV === "production",
} as const;
