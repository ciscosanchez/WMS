import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PackageX } from "lucide-react";
import { getBackorders } from "@/modules/orders/backorder-actions";
import { BackordersTable } from "@/components/orders/backorders-table";

export default async function BackordersPage() {
  const backorders = await getBackorders();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backorders"
        description="Orders waiting for inventory availability"
      />

      {backorders.length === 0 ? (
        <EmptyState
          icon={PackageX}
          title="No backorders"
          description="There are no backordered orders at this time."
        />
      ) : (
        <BackordersTable data={backorders} />
      )}
    </div>
  );
}
