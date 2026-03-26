/**
 * @jest-environment node
 */

export {};

const mockRequirePortalContext = jest.fn();
const mockRedirect = jest.fn((path: string) => {
  throw new Error(`redirect:${path}`);
});

jest.mock("@/lib/tenant/context", () => ({
  requirePortalContext: (...args: unknown[]) => mockRequirePortalContext(...args),
}));

jest.mock("next/navigation", () => ({
  redirect: (path: string) => mockRedirect(path),
}));

jest.mock("@/app/(portal)/portal-nav", () => {
  return function PortalNav({ children }: { children: React.ReactNode }) {
    return <div data-testid="portal-nav">{children}</div>;
  };
});

describe("PortalLayout boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the portal shell for portal-bound users", async () => {
    mockRequirePortalContext.mockResolvedValue({
      portalClientId: "client-1",
    });

    const Layout = (await import("@/app/(portal)/layout")).default;
    const result = await Layout({ children: <div>portal child</div> });

    expect(result).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects non-portal users back to the tenant dashboard", async () => {
    mockRequirePortalContext.mockRejectedValue(new Error("Forbidden: portal client binding required"));

    const Layout = (await import("@/app/(portal)/layout")).default;

    await expect(Layout({ children: <div>portal child</div> })).rejects.toThrow("redirect:/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });
});
