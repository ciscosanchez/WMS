import { getInventory } from "@/modules/inventory/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Boxes } from "lucide-react";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { EmptyState } from "@/components/shared/empty-state";

export default async function InventoryPage() {
  const inventory = await getInventory();

  return (
    <div className="space-y-6">
      <PageHeader title="Stock Browser" description="Current inventory across all locations" />

      {inventory.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No inventory yet"
          description="Inventory will appear here after receiving shipments."
        />
      ) : (
        <InventoryTable data={inventory} />
      )}
    </div>
  );
}
