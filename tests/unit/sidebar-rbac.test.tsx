/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import type { TenantRole } from "../../node_modules/.prisma/public-client";

const mockUsePathname = jest.fn();
const mockUseSession = jest.fn();
const mockUseTranslations = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

jest.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

jest.mock("next-intl", () => ({
  useTranslations: () => mockUseTranslations(),
}));

jest.mock("@/components/ui/sidebar", () => {
  const Div = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>;
  const Button = ({
    children,
    render,
    isActive: _isActive,
    ...props
  }: { children?: React.ReactNode; render?: React.ReactElement; isActive?: boolean; [key: string]: unknown }) => (
    <div {...props}>
      {render ?? null}
      {children}
    </div>
  );

  return {
    Sidebar: Div,
    SidebarContent: Div,
    SidebarGroup: Div,
    SidebarGroupContent: Div,
    SidebarGroupLabel: Div,
    SidebarHeader: Div,
    SidebarFooter: Div,
    SidebarMenu: Div,
    SidebarMenuItem: Div,
    SidebarMenuButton: Button,
  };
});

jest.mock("next/link", () => {
  const Link = ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  Link.displayName = "Link";
  return Link;
});

function setSession(role: TenantRole, isSuperadmin = false) {
  mockUseSession.mockReturnValue({
    status: "authenticated",
    data: {
      user: {
        isSuperadmin,
        tenants: [{ slug: "armstrong", role }],
      },
    },
  });
}

describe("AppSidebar RBAC visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue("/dashboard");
    mockUseTranslations.mockImplementation((_namespace?: string) => (key: string) => key);
  });

  it("shows only read-safe navigation for viewers", async () => {
    setSession("viewer");
    const { AppSidebar } = await import("@/components/layout/app-sidebar");

    render(<AppSidebar />);

    expect(screen.getByText("dashboard")).toBeInTheDocument();
    expect(screen.getByText("reports")).toBeInTheDocument();
    expect(screen.getByText("inboundShipments")).toBeInTheDocument();
    expect(screen.queryByText("settings")).not.toBeInTheDocument();
    expect(screen.queryByText("workflowRules")).not.toBeInTheDocument();
    expect(screen.queryByText("driverCheckIn")).not.toBeInTheDocument();
    expect(screen.queryByText("floorApp")).not.toBeInTheDocument();
  });

  it("shows settings and operator entrypoints for managers but hides admin-only items", async () => {
    setSession("manager");
    const { AppSidebar } = await import("@/components/layout/app-sidebar");

    render(<AppSidebar />);

    expect(screen.getByText("settings")).toBeInTheDocument();
    expect(screen.getByText("workflowRules")).toBeInTheDocument();
    expect(screen.getByText("floorApp")).toBeInTheDocument();
    expect(screen.getByText("laborCosts")).toBeInTheDocument();
    expect(screen.getByText("driverCheckIn")).toBeInTheDocument();
  });

  it("shows write-capable operational items for warehouse workers", async () => {
    setSession("warehouse_worker");
    const { AppSidebar } = await import("@/components/layout/app-sidebar");

    render(<AppSidebar />);

    expect(screen.getByText("driverCheckIn")).toBeInTheDocument();
    expect(screen.getByText("floorApp")).toBeInTheDocument();
    expect(screen.queryByText("settings")).not.toBeInTheDocument();
    expect(screen.queryByText("workflowRules")).not.toBeInTheDocument();
  });

  it("shows the full tenant navigation to admins and superadmins", async () => {
    setSession("admin", true);
    const { AppSidebar } = await import("@/components/layout/app-sidebar");

    render(<AppSidebar />);

    expect(screen.getByText("settings")).toBeInTheDocument();
    expect(screen.getByText("workflowRules")).toBeInTheDocument();
    expect(screen.getByText("driverCheckIn")).toBeInTheDocument();
    expect(screen.getByText("laborCosts")).toBeInTheDocument();
    expect(screen.getByText("floorApp")).toBeInTheDocument();
  });
});
