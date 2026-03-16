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

const mockTransactions = [
  {
    id: "1",
    type: "receive",
    product: { sku: "WIDGET-001" },
    fromBin: null,
    toBin: { barcode: "WH1-A-01-01-01-01" },
    quantity: 150,
    lotNumber: null,
    referenceType: "shipment",
    performedAt: new Date("2026-03-10"),
  },
  {
    id: "2",
    type: "receive",
    product: { sku: "GADGET-001" },
    fromBin: null,
    toBin: { barcode: "WH1-A-01-01-01-03" },
    quantity: 75,
    lotNumber: "LOT-2026-001",
    referenceType: "shipment",
    performedAt: new Date("2026-03-10"),
  },
  {
    id: "3",
    type: "putaway",
    product: { sku: "BOLT-M8X40" },
    fromBin: { barcode: "WH1-S-01-01-01-01" },
    toBin: { barcode: "WH1-B-02-01-01-05" },
    quantity: 500,
    lotNumber: "LOT-2026-003",
    referenceType: null,
    performedAt: new Date("2026-03-12"),
  },
  {
    id: "4",
    type: "move",
    product: { sku: "WIDGET-001" },
    fromBin: { barcode: "WH1-A-01-01-01-02" },
    toBin: { barcode: "WH1-A-01-01-01-01" },
    quantity: 50,
    lotNumber: null,
    referenceType: null,
    performedAt: new Date("2026-03-14"),
  },
  {
    id: "5",
    type: "adjust",
    product: { sku: "WIDGET-001" },
    fromBin: null,
    toBin: { barcode: "WH1-A-01-01-01-01" },
    quantity: -2,
    lotNumber: null,
    referenceType: "adjustment",
    performedAt: new Date("2026-03-15"),
  },
  {
    id: "6",
    type: "receive",
    product: { sku: "PIPE-SCH40" },
    fromBin: null,
    toBin: { barcode: "WH1-B-02-02-01-01" },
    quantity: 200,
    lotNumber: "LOT-2026-005",
    referenceType: "shipment",
    performedAt: new Date("2026-03-15"),
  },
];

export default function MovementsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Movements"
        description="Transaction ledger for all inventory changes"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Lot</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockTransactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>
                  <StatusBadge status={tx.type} />
                </TableCell>
                <TableCell className="font-medium">{tx.product.sku}</TableCell>
                <TableCell>{tx.fromBin?.barcode || "-"}</TableCell>
                <TableCell>{tx.toBin?.barcode || "-"}</TableCell>
                <TableCell className="text-right">{tx.quantity}</TableCell>
                <TableCell>{tx.lotNumber || "-"}</TableCell>
                <TableCell className="text-xs">{tx.referenceType || "-"}</TableCell>
                <TableCell>{format(tx.performedAt, "MMM d, HH:mm")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
