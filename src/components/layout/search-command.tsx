"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2Icon, PackageIcon, TruckIcon, ClipboardListIcon, SearchIcon } from "lucide-react";
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

interface SearchItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
}

const searchItems: SearchItem[] = [
  // Clients
  { id: "client-1", label: "ACME Corp", href: "/clients", icon: Building2Icon, group: "Clients" },
  {
    id: "client-2",
    label: "GLOBEX International",
    href: "/clients",
    icon: Building2Icon,
    group: "Clients",
  },
  {
    id: "client-3",
    label: "Initech Logistics",
    href: "/clients",
    icon: Building2Icon,
    group: "Clients",
  },
  {
    id: "client-4",
    label: "Umbrella Freight",
    href: "/clients",
    icon: Building2Icon,
    group: "Clients",
  },
  // Products
  {
    id: "prod-1",
    label: "WIDGET-001 — Standard Widget",
    href: "/products",
    icon: PackageIcon,
    group: "Products",
  },
  {
    id: "prod-2",
    label: "WIDGET-002 — Premium Widget",
    href: "/products",
    icon: PackageIcon,
    group: "Products",
  },
  {
    id: "prod-3",
    label: "GADGET-010 — Mini Gadget",
    href: "/products",
    icon: PackageIcon,
    group: "Products",
  },
  {
    id: "prod-4",
    label: "PART-100 — Replacement Part",
    href: "/products",
    icon: PackageIcon,
    group: "Products",
  },
  // Shipments
  {
    id: "asn-1",
    label: "ASN-2026-0001 — ACME inbound",
    href: "/receiving",
    icon: TruckIcon,
    group: "Shipments",
  },
  {
    id: "asn-2",
    label: "ASN-2026-0002 — GLOBEX inbound",
    href: "/receiving",
    icon: TruckIcon,
    group: "Shipments",
  },
  {
    id: "asn-3",
    label: "ASN-2026-0003 — Initech inbound",
    href: "/receiving",
    icon: TruckIcon,
    group: "Shipments",
  },
  {
    id: "asn-4",
    label: "ASN-2026-0004 — Umbrella inbound",
    href: "/receiving",
    icon: TruckIcon,
    group: "Shipments",
  },
  // Orders
  {
    id: "ord-1",
    label: "ORD-2026-0001 — ACME order",
    href: "/orders",
    icon: ClipboardListIcon,
    group: "Orders",
  },
  {
    id: "ord-2",
    label: "ORD-2026-0002 — GLOBEX order",
    href: "/orders",
    icon: ClipboardListIcon,
    group: "Orders",
  },
  {
    id: "ord-3",
    label: "ORD-2026-0003 — Initech rush order",
    href: "/orders",
    icon: ClipboardListIcon,
    group: "Orders",
  },
  {
    id: "ord-4",
    label: "ORD-2026-0004 — Umbrella order",
    href: "/orders",
    icon: ClipboardListIcon,
    group: "Orders",
  },
];

const groups = ["Clients", "Products", "Shipments", "Orders"] as const;

export function SearchCommand() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleSelect(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-56 justify-between text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <span className="flex items-center gap-2">
          <SearchIcon className="size-3.5" />
          <span className="text-xs">Search...</span>
        </span>
        <kbd className="pointer-events-none inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Global Search"
        description="Search clients, products, shipments, and orders"
      >
        <Command>
          <CommandInput placeholder="Type to search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {groups.map((group, idx) => (
              <React.Fragment key={group}>
                {idx > 0 && <CommandSeparator />}
                <CommandGroup heading={group}>
                  {searchItems
                    .filter((item) => item.group === group)
                    .map((item) => (
                      <CommandItem key={item.id} onSelect={() => handleSelect(item.href)}>
                        <item.icon className="size-4 text-muted-foreground" />
                        <span>{item.label}</span>
                      </CommandItem>
                    ))}
                </CommandGroup>
              </React.Fragment>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
