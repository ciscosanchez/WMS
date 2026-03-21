import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListChecks } from "lucide-react";
import { format } from "date-fns";
import { getCycleCounts } from "@/modules/inventory/actions";

const statusLabels: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

export default async function CycleCountsPage() {
  const counts = await getCycleCounts();

  const activeCount = counts.filter((c) => !["completed", "rejected"].includes(c.status)).length;
  const completedCount = counts.filter((c) => c.status === "completed").length;
  const totalLines = counts.reduce((sum, c) => sum + c.lines.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Cycle Counts" description="Inventory count adjustments (type: cycle_count)" />

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Active</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <span className="text-sm text-muted-foreground">Completed</span>
            <p className="mt-1 text-2xl font-bold text-green-600">{completedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <span className="text-sm text-muted-foreground">Total Lines Counted</span>
            <p className="mt-1 text-2xl font-bold">{totalLines}</p>
          </CardContent>
        </Card>
      </div>

      {/* Counts table */}
      <Card>
        <CardHeader>
          <CardTitle>Cycle Counts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {counts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No cycle counts yet. Create one from the Adjustments page with type &quot;Cycle Count&quot;.
                  </TableCell>
                </TableRow>
              ) : (
                counts.map((count) => (
                  <TableRow key={count.id}>
                    <TableCell className="font-medium font-mono">{count.adjustmentNumber}</TableCell>
                    <TableCell>{count.reason ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{count.lines.length} items</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={statusLabels[count.status] ?? count.status} />
                    </TableCell>
                    <TableCell>{format(count.createdAt, "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      {count.completedAt ? format(count.completedAt, "MMM d, yyyy") : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
