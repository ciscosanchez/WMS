import { requireAuth } from "@/lib/auth/session";
import { OfflineProvider } from "@/providers/offline-provider";
import OperatorNav from "./operator-nav";

export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <OfflineProvider>
      <OperatorNav>{children}</OperatorNav>
    </OfflineProvider>
  );
}
