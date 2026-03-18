import { requireAuth } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import PlatformNav from "./platform-nav";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  if (!user.isSuperadmin) redirect("/");
  return <PlatformNav>{children}</PlatformNav>;
}
