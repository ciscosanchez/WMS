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
import { ScanLine, Clock, CheckCircle, AlertCircle, UserPlus, Eye } from "lucide-react";
import { toast } from "sonner";

const initialPickTasks = [
  {
    id: "1",
    taskNumber: "PICK-2026-0012",
    method: "single_order",
    status: "in_progress",
    assignedTo: "Carlos M.",
    orderNumber: "ORD-2026-0002",
    orderId: "2",
    items: 1,
    startedAt: "10:30 AM",
  },
  {
    id: "2",
    taskNumber: "PICK-2026-0013",
    method: "batch",
    status: "pending",
    assignedTo: null as string | null,
    orderNumber: "ORD-2026-0003",
    orderId: "3",
    items: 12,
    startedAt: null as string | null,
  },
  {
    id: "3",
    taskNumber: "PICK-2026-0014",
    method: "single_order",
    status: "pending",
    assignedTo: null as string | null,
    orderNumber: "ORD-2026-0004",
    orderId: "4",
    items: 2,
    startedAt: null as string | null,
  },
  {
    id: "4",
    taskNumber: "PICK-2026-0011",
    method: "single_order",
    status: "completed",
    assignedTo: "Maria L.",
    orderNumber: "ORD-2026-0001",
    orderId: "1",
    items: 3,
    startedAt: "9:15 AM",
  },
];

const SHOW_COMPLETED_LIMIT = 3;

export default function PickingPage() {
  const [tasks, setTasks] = useState(initialPickTasks);
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  const activeTasks = tasks.filter((t) => t.status !== "completed");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const visibleCompleted = showAllCompleted
    ? completedTasks
    : completedTasks.slice(0, SHOW_COMPLETED_LIMIT);
  const displayTasks = [...activeTasks, ...visibleCompleted];

  function handleAssignToMe(taskId: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, assignedTo: "You", status: "in_progress" } : t))
    );
    toast.success("Task assigned to you");
  }

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
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.taskNumber}</TableCell>
                  <TableCell>
                    <Link href={`/orders/${task.orderId}`} className="text-primary hover:underline">
                      {task.orderNumber}
                    </Link>
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
                  <TableCell>{task.startedAt || "-"}</TableCell>
                  <TableCell>
                    {!task.assignedTo && task.status === "pending" && (
                      <Button variant="ghost" size="sm" onClick={() => handleAssignToMe(task.id)}>
                        <UserPlus className="mr-1 h-3 w-3" />
                        Assign to me
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
