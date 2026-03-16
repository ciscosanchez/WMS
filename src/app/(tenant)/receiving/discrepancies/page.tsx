import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

const mockDiscrepancies = [
  {
    id: "1",
    shipmentNumber: "ASN-2026-0002",
    type: "shortage",
    description: "Missing 5 units of BOLT-M8X40 from pallet 3",
    expectedQty: 100,
    actualQty: 95,
    status: "open",
    createdAt: new Date("2026-03-15"),
  },
  {
    id: "2",
    shipmentNumber: "ASN-2026-0001",
    type: "damage",
    description: "Water damage on 3 units of WIDGET-001",
    expectedQty: null,
    actualQty: null,
    status: "resolved",
    createdAt: new Date("2026-03-10"),
  },
];

export default function DiscrepanciesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Receiving Discrepancies"
        description="Shortages, overages, and damage reports"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shipment</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Actual</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockDiscrepancies.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.shipmentNumber}</TableCell>
                <TableCell>
                  <StatusBadge status={d.type} />
                </TableCell>
                <TableCell>{d.description}</TableCell>
                <TableCell>{d.expectedQty ?? "-"}</TableCell>
                <TableCell>{d.actualQty ?? "-"}</TableCell>
                <TableCell>
                  <StatusBadge status={d.status} />
                </TableCell>
                <TableCell>{format(d.createdAt, "MMM d, yyyy")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
