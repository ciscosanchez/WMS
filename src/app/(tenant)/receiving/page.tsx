import { getShipments } from "@/modules/receiving/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus, PackageOpen } from "lucide-react";
import Link from "next/link";
import { ShipmentsTable } from "@/components/receiving/shipments-table";
import { EmptyState } from "@/components/shared/empty-state";

export default async function ReceivingPage() {
  const shipments = await getShipments();

  return (
    <div className="space-y-6">
      <PageHeader title="Inbound Shipments" description="Manage ASNs and receiving">
        <Button asChild>
          <Link href="/receiving/new">
            <Plus className="mr-2 h-4 w-4" />
            New Shipment
          </Link>
        </Button>
      </PageHeader>

      {shipments.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="No shipments yet"
          description="Create an inbound shipment to start receiving inventory."
        >
          <Button asChild>
            <Link href="/receiving/new">
              <Plus className="mr-2 h-4 w-4" />
              New Shipment
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <ShipmentsTable data={shipments} />
      )}
    </div>
  );
}
