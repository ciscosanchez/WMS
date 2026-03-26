/**
 * @jest-environment node
 */

export {};

const mockUserFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockSessionDeleteMany = jest.fn();
const mockSendPasswordResetLink = jest.fn();
const mockHash = jest.fn();
const mockLimiterCheck = jest.fn();

jest.mock("@/lib/db/public-client", () => ({
  publicDb: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    session: {
      deleteMany: (...args: unknown[]) => mockSessionDeleteMany(...args),
    },
  },
}));

jest.mock("@/lib/email/resend", () => ({
  sendPasswordResetLink: (...args: unknown[]) => mockSendPasswordResetLink(...args),
}));

jest.mock("bcryptjs", () => ({
  hash: (...args: unknown[]) => mockHash(...args),
}));

jest.mock("@/lib/security/rate-limit", () => ({
  RateLimiter: jest.fn().mockImplementation(() => ({
    check: (...args: unknown[]) => mockLimiterCheck(...args),
  })),
}));

describe("auth password reset actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLimiterCheck.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: new Date("2026-03-26T00:00:00Z"),
    });
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;
  });

  it("returns a generic success response when the user does not exist", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const { requestPasswordReset } = await import("@/modules/auth/actions");
    const result = await requestPasswordReset("missing@example.com");

    expect(result).toEqual({
      message: "If an account exists with that email, a reset link has been sent.",
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockSendPasswordResetLink).not.toHaveBeenCalled();
  });

  it("stores a reset token and sends a reset email for an existing user", async () => {
    process.env.AUTH_URL = "https://wms.ramola.app";
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "User Example",
      locale: null,
      tenantUsers: [
        {
          tenant: {
            settings: {
              locale: "es",
            },
          },
        },
      ],
    });
    mockUserUpdate.mockResolvedValue({});
    mockSendPasswordResetLink.mockResolvedValue({ sent: true });

    const { requestPasswordReset } = await import("@/modules/auth/actions");
    const result = await requestPasswordReset("USER@example.com", "en");

    expect(result).toEqual({
      message: "If an account exists with that email, a reset link has been sent.",
    });
    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
    expect(mockUserUpdate.mock.calls[0][0]).toEqual({
      where: { id: "user-1" },
      data: {
        passwordSetToken: expect.any(String),
        passwordSetExpires: expect.any(Date),
      },
    });
    expect(mockSendPasswordResetLink).toHaveBeenCalledWith({
      to: "user@example.com",
      name: "User Example",
      resetPasswordUrl: expect.stringMatching(
        /^https:\/\/wms\.ramola\.app\/reset-password\?token=[a-f0-9]+&email=user%40example\.com$/
      ),
      locale: "es",
    });
  });

  it("rejects reset attempts with an invalid token", async () => {
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      passwordSetToken: "not-the-right-hash",
      passwordSetExpires: new Date(Date.now() + 60_000),
    });

    const { resetPasswordWithToken } = await import("@/modules/auth/actions");
    const result = await resetPasswordWithToken({
      email: "user@example.com",
      token: "raw-token",
      password: "NewPassword123",
    });

    expect(result).toEqual({ error: "Invalid or expired reset link." });
    expect(mockHash).not.toHaveBeenCalled();
    expect(mockSessionDeleteMany).not.toHaveBeenCalled();
  });

  it("resets the password, clears the token, and invalidates sessions", async () => {
    const { createHash } = await import("crypto");
    const rawToken = "known-raw-token";
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      passwordSetToken: tokenHash,
      passwordSetExpires: new Date(Date.now() + 60_000),
    });
    mockHash.mockResolvedValue("hashed-password");
    mockUserUpdate.mockResolvedValue({});
    mockSessionDeleteMany.mockResolvedValue({ count: 2 });

    const { resetPasswordWithToken } = await import("@/modules/auth/actions");
    const result = await resetPasswordWithToken({
      email: "USER@example.com",
      token: rawToken,
      password: "NewPassword123",
    });

    expect(result).toEqual({
      message: "Password has been reset. Please log in with your new password.",
    });
    expect(mockHash).toHaveBeenCalledWith("NewPassword123", 12);
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        passwordHash: "hashed-password",
        passwordSetToken: null,
        passwordSetExpires: null,
        authVersion: { increment: 1 },
      },
    });
    expect(mockSessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });
});
