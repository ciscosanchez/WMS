import Link from "next/link";
import {
  Warehouse,
  PackageOpen,
  ScanLine,
  Package,
  ArrowLeftRight,
  ListChecks,
} from "lucide-react";

const navItems = [
  { href: "/receive", label: "Receive", icon: PackageOpen },
  { href: "/pick", label: "Pick", icon: ScanLine },
  { href: "/pack", label: "Pack", icon: Package },
  { href: "/move", label: "Move", icon: ArrowLeftRight },
  { href: "/count", label: "Count", icon: ListChecks },
];

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-14 items-center justify-between border-b px-4">
        <Link href="/receive" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Warehouse className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold">Ramola</span>
          <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
            Floor
          </span>
        </Link>
        <span className="text-sm text-muted-foreground">Carlos M.</span>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4">{children}</main>

      {/* Bottom navigation — mobile-optimized */}
      <nav className="border-t bg-background">
        <div className="flex justify-around">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-1 py-3 text-xs text-muted-foreground hover:text-foreground"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
