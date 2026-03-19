describe("config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("useMockData — fail-closed (must opt-in with '=== true')", () => {
    it("is false when USE_MOCK_DATA is not set", async () => {
      delete process.env.USE_MOCK_DATA;
      const { config } = await import("@/lib/config");
      expect(config.useMockData).toBe(false);
    });

    it('is true when USE_MOCK_DATA is "true"', async () => {
      process.env.USE_MOCK_DATA = "true";
      const { config } = await import("@/lib/config");
      expect(config.useMockData).toBe(true);
    });

    it('is false when USE_MOCK_DATA is "false"', async () => {
      process.env.USE_MOCK_DATA = "false";
      const { config } = await import("@/lib/config");
      expect(config.useMockData).toBe(false);
    });

    it("is false for any non-'true' string value", async () => {
      process.env.USE_MOCK_DATA = "yes";
      const { config } = await import("@/lib/config");
      expect(config.useMockData).toBe(false);
    });
  });

  describe("useMockAuth — fail-closed (must opt-in with '=== true')", () => {
    it("is false when USE_MOCK_AUTH is not set", async () => {
      delete process.env.USE_MOCK_AUTH;
      const { config } = await import("@/lib/config");
      expect(config.useMockAuth).toBe(false);
    });

    it('is true when USE_MOCK_AUTH is "true"', async () => {
      process.env.USE_MOCK_AUTH = "true";
      const { config } = await import("@/lib/config");
      expect(config.useMockAuth).toBe(true);
    });

    it('is false when USE_MOCK_AUTH is "false"', async () => {
      process.env.USE_MOCK_AUTH = "false";
      const { config } = await import("@/lib/config");
      expect(config.useMockAuth).toBe(false);
    });
  });
});
