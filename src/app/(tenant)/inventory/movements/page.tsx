import { getInventoryTransactions } from "@/modules/inventory/actions";
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

export default async function MovementsPage() {
  const transactions = await getInventoryTransactions();

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
            {transactions.map((tx: any) => (
              <TableRow key={tx.id}>
                <TableCell>
                  <StatusBadge status={tx.type} />
                </TableCell>
                <TableCell className="font-medium">
                  {tx.product?.sku || tx.product}
                </TableCell>
                <TableCell>{tx.fromBin?.barcode || "-"}</TableCell>
                <TableCell>{tx.toBin?.barcode || "-"}</TableCell>
                <TableCell className="text-right">{tx.quantity}</TableCell>
                <TableCell>{tx.lotNumber || "-"}</TableCell>
                <TableCell className="text-xs">{tx.referenceType || "-"}</TableCell>
                <TableCell>{format(new Date(tx.performedAt), "MMM d, HH:mm")}</TableCell>
              </TableRow>
            ))}
            {transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No transactions yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
