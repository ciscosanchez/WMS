describe("config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('useMockData is true when USE_MOCK_DATA is not set', async () => {
    delete process.env.USE_MOCK_DATA;
    const { config } = await import("@/lib/config");
    expect(config.useMockData).toBe(true);
  });

  it('useMockData is true when USE_MOCK_DATA is "true"', async () => {
    process.env.USE_MOCK_DATA = "true";
    const { config } = await import("@/lib/config");
    expect(config.useMockData).toBe(true);
  });

  it('useMockData is false when USE_MOCK_DATA is "false"', async () => {
    process.env.USE_MOCK_DATA = "false";
    const { config } = await import("@/lib/config");
    expect(config.useMockData).toBe(false);
  });

  it('useMockData is true for any other string value', async () => {
    process.env.USE_MOCK_DATA = "yes";
    const { config } = await import("@/lib/config");
    expect(config.useMockData).toBe(true);
  });
});
