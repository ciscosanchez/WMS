import { getAdjustments } from "@/modules/inventory/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

export default async function AdjustmentsPage() {
  const adjustments = await getAdjustments();

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Adjustments" description="Corrections and cycle count results">
        <Button asChild>
          <Link href="/inventory/adjustments/new">
            <Plus className="mr-2 h-4 w-4" />
            New Adjustment
          </Link>
        </Button>
      </PageHeader>

      {adjustments.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No adjustments"
          description="Create an adjustment to correct inventory discrepancies."
        >
          <Button asChild>
            <Link href="/inventory/adjustments/new">
              <Plus className="mr-2 h-4 w-4" />
              New Adjustment
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {adjustments.map((adj: any) => (
                <TableRow key={adj.id}>
                  <TableCell className="font-medium">{adj.adjustmentNumber}</TableCell>
                  <TableCell className="capitalize">{adj.type.replace("_", " ")}</TableCell>
                  <TableCell>
                    <StatusBadge status={adj.status} />
                  </TableCell>
                  <TableCell>{adj.lines?.length ?? 0}</TableCell>
                  <TableCell>{adj.reason || "-"}</TableCell>
                  <TableCell>{format(new Date(adj.createdAt), "MMM d, yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
