import { requireAuth } from "@/lib/auth/session";
import PortalNav from "./portal-nav";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <PortalNav>{children}</PortalNav>;
}
