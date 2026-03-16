import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { ShipmentsTable } from "@/components/receiving/shipments-table";

const mockShipments = [
  {
    id: "1",
    shipmentNumber: "ASN-2026-0001",
    status: "completed",
    carrier: "FedEx Freight",
    expectedDate: "2026-03-10",
    createdAt: "2026-03-08",
    client: { code: "ACME", name: "Acme Corporation" },
    _count: { lines: 3, transactions: 5, discrepancies: 0 },
  },
  {
    id: "2",
    shipmentNumber: "ASN-2026-0002",
    status: "receiving",
    carrier: "XPO Logistics",
    expectedDate: "2026-03-15",
    createdAt: "2026-03-12",
    client: { code: "GLOBEX", name: "Globex Industries" },
    _count: { lines: 5, transactions: 2, discrepancies: 1 },
  },
  {
    id: "3",
    shipmentNumber: "ASN-2026-0003",
    status: "arrived",
    carrier: "SAIA",
    expectedDate: "2026-03-16",
    createdAt: "2026-03-13",
    client: { code: "INITECH", name: "Initech Logistics" },
    _count: { lines: 2, transactions: 0, discrepancies: 0 },
  },
  {
    id: "4",
    shipmentNumber: "ASN-2026-0004",
    status: "expected",
    carrier: "Old Dominion",
    expectedDate: "2026-03-18",
    createdAt: "2026-03-14",
    client: { code: "STARK", name: "Stark Shipping Co" },
    _count: { lines: 4, transactions: 0, discrepancies: 0 },
  },
  {
    id: "5",
    shipmentNumber: "ASN-2026-0005",
    status: "draft",
    carrier: null,
    expectedDate: null,
    createdAt: "2026-03-16",
    client: { code: "ACME", name: "Acme Corporation" },
    _count: { lines: 0, transactions: 0, discrepancies: 0 },
  },
];

export default function ReceivingPage() {
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

      <ShipmentsTable data={mockShipments} />
    </div>
  );
}
