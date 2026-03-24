"use client";

import { useState } from "react";
import Link from "next/link";
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
import { ScanLine, Clock, CheckCircle, AlertCircle, Eye } from "lucide-react";

interface PickTask {
  id: string;
  taskNumber: string;
  method: string;
  status: string;
  assignedTo: string | null;
  orderId: string | null;
  orderNumber: string;
  items: number;
  startedAt: Date | null;
  completedAt: Date | null;
}

interface Kpis {
  pending: number;
  inProgress: number;
  completedToday: number;
  shortPicked: number;
}

const SHOW_COMPLETED_LIMIT = 5;

export function PickingClient({ tasks, kpis }: { tasks: PickTask[]; kpis: Kpis }) {
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  const activeTasks = tasks.filter((t) => t.status !== "completed");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const visibleCompleted = showAllCompleted
    ? completedTasks
    : completedTasks.slice(0, SHOW_COMPLETED_LIMIT);
  const displayTasks = [...activeTasks, ...visibleCompleted];

  return (
    <div className="space-y-6">
      <PageHeader title="Picking" description="Pick tasks and wave management">
        <div className="flex gap-2">
          <Button variant="outline">Create Wave</Button>
          <Button>Generate Pick Tasks</Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Pending" value={kpis.pending} description="Tasks waiting" icon={Clock} />
        <KpiCard
          title="In Progress"
          value={kpis.inProgress}
          description="Being picked"
          icon={ScanLine}
        />
        <KpiCard
          title="Completed Today"
          value={kpis.completedToday}
          description="Tasks done"
          icon={CheckCircle}
        />
        <KpiCard
          title="Short Picks"
          value={kpis.shortPicked}
          description="Needs attention"
          icon={AlertCircle}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Pick Tasks</CardTitle>
            {completedTasks.length > SHOW_COMPLETED_LIMIT && !showAllCompleted && (
              <Button variant="ghost" size="sm" onClick={() => setShowAllCompleted(true)}>
                <Eye className="mr-2 h-4 w-4" />
                View All Completed ({completedTasks.length})
              </Button>
            )}
          </div>
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
              {displayTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No pick tasks yet. Tasks are created when orders move to &quot;picking&quot;
                    status.
                  </TableCell>
                </TableRow>
              ) : (
                displayTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium">{task.taskNumber}</TableCell>
                    <TableCell>
                      {task.orderId ? (
                        <Link
                          href={`/orders/${task.orderId}`}
                          className="text-primary hover:underline"
                        >
                          {task.orderNumber}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </TableCell>
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
                    <TableCell>
                      {task.startedAt ? new Date(task.startedAt).toLocaleTimeString() : "-"}
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
