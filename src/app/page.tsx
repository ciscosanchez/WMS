import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getDefaultTenantPath } from "@/lib/auth/personas";
import { buildTenantAppUrl, getAppHost } from "@/lib/app-runtime";

function isBaseDomainHost(host: string): boolean {
  const normalizedHost = host.split(":")[0] ?? host;
  if (normalizedHost === "localhost" || normalizedHost === "127.0.0.1") return true;
  return normalizedHost === getAppHost();
}

export default async function Home() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const host = (await headers()).get("host") ?? "";
  const user = session.user;

  if (isBaseDomainHost(host)) {
    if (user.isSuperadmin) {
      redirect("/platform");
    }

    const firstTenant = user.tenants[0];
    if (!firstTenant) {
      redirect("/login");
    }

    redirect(buildTenantAppUrl(firstTenant.slug, getDefaultTenantPath(user, firstTenant.slug)));
  }

  redirect(getDefaultTenantPath(user, host.split(".")[0] ?? null));
}
