import { requireAuth } from "@/lib/auth/session";
import OperatorNav from "./operator-nav";

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return <OperatorNav>{children}</OperatorNav>;
}
