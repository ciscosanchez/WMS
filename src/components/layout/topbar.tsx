"use client";

import { useSession, signOut } from "next-auth/react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Globe, Check } from "lucide-react";
import { toast } from "sonner";
import { Breadcrumbs } from "./breadcrumbs";
import { SearchCommand } from "./search-command";
import { NotificationBell } from "./notification-bell";
import { updateUserLocale } from "@/modules/users/actions";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

const LOCALE_LABELS: Record<string, string> = {
  en: "English",
  es: "Español",
};

function getInitials(name: string | undefined | null): string {
  if (!name) return "??";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Topbar() {
  const { data: session } = useSession();
  const locale = useLocale();
  const router = useRouter();

  const userName = USE_MOCK ? "Admin User" : (session?.user?.name ?? "User");
  const userEmail = USE_MOCK ? "admin@ramola.io" : (session?.user?.email ?? "");
  const initials = getInitials(userName);

  async function handleSignOut() {
    if (USE_MOCK) {
      window.location.href = "/login";
      return;
    }
    // Sign out without NextAuth's redirect (it routes through AUTH_URL
    // which is wms.ramola.app, losing the tenant subdomain).
    // Instead, clear the session then redirect manually.
    await signOut({ redirect: false });
    window.location.href = `${window.location.origin}/login`;
  }

  async function handleLocaleChange(newLocale: string) {
    if (newLocale === locale) return;
    try {
      const result = await updateUserLocale(newLocale);
      if (result.error) {
        toast.error(result.error);
      } else {
        window.location.reload();
      }
    } catch {
      toast.error("Failed to change language");
    }
  }

  async function handleResetLocale() {
    const result = await updateUserLocale(null);
    if (result.error) {
      toast.error(result.error);
    } else {
      window.location.reload();
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-2">
        <SearchCommand />
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-1.5 py-1.5">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Globe className="mr-2 h-4 w-4" />
                {LOCALE_LABELS[locale] ?? locale}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {Object.entries(LOCALE_LABELS).map(([code, label]) => (
                  <DropdownMenuItem key={code} onClick={() => handleLocaleChange(code)}>
                    {locale === code && <Check className="mr-2 h-4 w-4" />}
                    <span className={locale !== code ? "ml-6" : ""}>{label}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleResetLocale()}>
                  <span className="ml-6 text-muted-foreground">Use tenant default</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
