import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
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

const mockAdjustments = [
  {
    id: "1",
    adjustmentNumber: "ADJ-2026-0001",
    type: "cycle_count",
    status: "completed",
    lines: [1, 2, 3],
    reason: "Monthly cycle count - Zone A",
    createdAt: new Date("2026-03-01"),
  },
  {
    id: "2",
    adjustmentNumber: "ADJ-2026-0002",
    type: "adjustment",
    status: "pending_approval",
    lines: [1],
    reason: "Damaged goods write-off",
    createdAt: new Date("2026-03-14"),
  },
  {
    id: "3",
    adjustmentNumber: "ADJ-2026-0003",
    type: "cycle_count",
    status: "draft",
    lines: [1, 2, 3, 4, 5],
    reason: "Weekly count - Zone B",
    createdAt: new Date("2026-03-16"),
  },
];

export default function AdjustmentsPage() {
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
            {mockAdjustments.map((adj) => (
              <TableRow key={adj.id}>
                <TableCell className="font-medium">{adj.adjustmentNumber}</TableCell>
                <TableCell className="capitalize">{adj.type.replace("_", " ")}</TableCell>
                <TableCell>
                  <StatusBadge status={adj.status} />
                </TableCell>
                <TableCell>{adj.lines.length}</TableCell>
                <TableCell>{adj.reason || "-"}</TableCell>
                <TableCell>{format(adj.createdAt, "MMM d, yyyy")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
