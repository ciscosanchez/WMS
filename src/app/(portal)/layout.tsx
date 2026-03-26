import { requirePortalContext } from "@/lib/tenant/context";
import { redirect } from "next/navigation";
import PortalNav from "./portal-nav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  try {
    await requirePortalContext();
  } catch {
    redirect("/dashboard");
  }
  return <PortalNav>{children}</PortalNav>;
}
