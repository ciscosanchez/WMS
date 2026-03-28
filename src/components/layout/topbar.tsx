"use client";

import { useSession, signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
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
import { clearLocaleCookie, updateUserLocale } from "@/modules/users/actions";
import { getLocaleLabels } from "@/lib/app-runtime";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
const LOCALE_LABELS = getLocaleLabels();

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
  const { isMobile } = useSidebar();
  const locale = useLocale();
  const tCommon = useTranslations("common");

  const userName = USE_MOCK ? "Admin User" : (session?.user?.name ?? "User");
  const userEmail = USE_MOCK ? "admin@ramola.io" : (session?.user?.email ?? "");
  const initials = getInitials(userName);
  const localeLabel =
    locale in LOCALE_LABELS ? LOCALE_LABELS[locale as keyof typeof LOCALE_LABELS] : locale;

  async function handleSignOut() {
    if (USE_MOCK) {
      window.location.href = "/login";
      return;
    }
    await clearLocaleCookie();
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
      toast.error(tCommon("failedToChangeLanguage"));
    }
  }

  async function handleResetLocale() {
    try {
      const result = await updateUserLocale(null);
      if (result.error) {
        toast.error(result.error);
      } else {
        window.location.reload();
      }
    } catch {
      toast.error(tCommon("failedToChangeLanguage"));
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      {isMobile ? (
        <>
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
        </>
      ) : null}
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
                {localeLabel}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {Object.entries(LOCALE_LABELS).map(([code, label]) => (
                  <DropdownMenuItem key={code} onClick={() => handleLocaleChange(code)}>
                    {locale === code && <Check className="mr-2 h-4 w-4" />}
                    <span className={locale !== code ? "ml-6" : ""}>{label}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void handleResetLocale()}>
                  <span className="ml-6 text-muted-foreground">{tCommon("useTenantDefault")}</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={() => void handleSignOut()}>
              {tCommon("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
