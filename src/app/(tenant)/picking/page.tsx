import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/shared/kpi-card";
import { ScanLine, Clock, CheckCircle, AlertCircle } from "lucide-react";

const mockPickTasks = [
  {
    id: "1",
    taskNumber: "PICK-2026-0012",
    method: "single_order",
    status: "in_progress",
    assignedTo: "Carlos M.",
    orderNumber: "ORD-2026-0002",
    items: 1,
    startedAt: "10:30 AM",
  },
  {
    id: "2",
    taskNumber: "PICK-2026-0013",
    method: "batch",
    status: "pending",
    assignedTo: null,
    orderNumber: "ORD-2026-0003",
    items: 12,
    startedAt: null,
  },
  {
    id: "3",
    taskNumber: "PICK-2026-0014",
    method: "single_order",
    status: "pending",
    assignedTo: null,
    orderNumber: "ORD-2026-0004",
    items: 2,
    startedAt: null,
  },
  {
    id: "4",
    taskNumber: "PICK-2026-0011",
    method: "single_order",
    status: "completed",
    assignedTo: "Maria L.",
    orderNumber: "ORD-2026-0001",
    items: 3,
    startedAt: "9:15 AM",
  },
];

export default function PickingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Picking" description="Pick tasks and wave management">
        <div className="flex gap-2">
          <Button variant="outline">Create Wave</Button>
          <Button>Generate Pick Tasks</Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Pending" value={2} description="Tasks waiting" icon={Clock} />
        <KpiCard title="In Progress" value={1} description="Being picked" icon={ScanLine} />
        <KpiCard title="Completed Today" value={8} description="Tasks done" icon={CheckCircle} />
        <KpiCard title="Short Picks" value={0} description="Needs attention" icon={AlertCircle} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pick Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task #</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockPickTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.taskNumber}</TableCell>
                  <TableCell>{task.orderNumber}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {task.method.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{task.items}</TableCell>
                  <TableCell>
                    {task.assignedTo || <span className="text-muted-foreground">Unassigned</span>}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={task.status} />
                  </TableCell>
                  <TableCell>{task.startedAt || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
