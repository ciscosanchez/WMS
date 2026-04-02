import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
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
import { ListChecks, Plus } from "lucide-react";
import { format } from "date-fns";
import { getCycleCounts } from "@/modules/inventory/putaway-actions";
import { getCycleCountPlans } from "@/modules/inventory/cycle-count-actions";
import { CycleCountPlansTable } from "@/components/inventory/cycle-count-plans-table";

type CycleCountItem = Awaited<ReturnType<typeof getCycleCounts>>[number];

const statusLabels: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

export default async function CycleCountsPage() {
  const [plans, counts] = await Promise.all([
    getCycleCountPlans(),
    getCycleCounts(),
  ]);

  const activeCount = counts.filter(
    (c: CycleCountItem) => !["completed", "rejected"].includes(c.status)
  ).length;
  const completedCount = counts.filter(
    (c: CycleCountItem) => c.status === "completed"
  ).length;
  const totalLines = counts.reduce(
    (sum: number, c: CycleCountItem) => sum + c.lines.length,
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cycle Counts"
        description="Manage cycle count plans and track inventory counts"
      >
        <Button asChild>
          <Link href="/inventory/cycle-counts/new">
            <Plus className="mr-2 h-4 w-4" />
            New Plan
          </Link>
        </Button>
      </PageHeader>

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
            <p className="mt-1 text-2xl font-bold text-green-600">
              {completedCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <span className="text-sm text-muted-foreground">
              Total Lines Counted
            </span>
            <p className="mt-1 text-2xl font-bold">{totalLines}</p>
          </CardContent>
        </Card>
      </div>

      {/* Plans section */}
      <Card>
        <CardHeader>
          <CardTitle>Cycle Count Plans</CardTitle>
        </CardHeader>
        <CardContent>
          {plans.data.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No plans yet"
              description="Create a cycle count plan to schedule recurring counts."
            />
          ) : (
            <CycleCountPlansTable
              data={
                plans.data as Array<{
                  id: string;
                  name: string;
                  method: string;
                  frequency: string;
                  isActive: boolean;
                  lastRunAt: Date | string | null;
                  nextRunAt: Date | string | null;
                  createdAt: Date | string;
                }>
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Recent cycle counts table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Cycle Counts</CardTitle>
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
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-8"
                  >
                    No cycle counts yet
                  </TableCell>
                </TableRow>
              ) : (
                counts.map((count: CycleCountItem) => (
                  <TableRow key={count.id}>
                    <TableCell className="font-medium font-mono">
                      {count.adjustmentNumber}
                    </TableCell>
                    <TableCell>{count.reason ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {count.lines.length} items
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={statusLabels[count.status] ?? count.status}
                      />
                    </TableCell>
                    <TableCell>
                      {format(count.createdAt, "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {count.completedAt
                        ? format(count.completedAt, "MMM d, yyyy")
                        : "-"}
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
