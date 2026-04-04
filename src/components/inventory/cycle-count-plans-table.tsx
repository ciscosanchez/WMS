"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { SortableHeader } from "@/components/data-table/sortable-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Play, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  generateCycleCountTasks,
  deleteCycleCountPlan,
} from "@/modules/inventory/cycle-count-actions";

interface CycleCountPlan {
  id: string;
  name: string;
  method: string;
  frequency: string;
  isActive: boolean;
  lastRunAt: Date | string | null;
  nextRunAt: Date | string | null;
  createdAt: Date | string;
}

function ActionsCell({ plan }: { plan: CycleCountPlan }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGenerateTasks() {
    setLoading(true);
    try {
      const result = await generateCycleCountTasks(plan.id);
      if (result.lineCount === 0) {
        toast.info(result.message ?? "No inventory matched the plan criteria");
      } else {
        toast.success(`Generated ${result.lineCount} cycle count tasks`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate tasks");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete plan "${plan.name}"?`)) return;
    setLoading(true);
    try {
      await deleteCycleCountPlan(plan.id);
      toast.success("Plan deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={loading} onClick={handleGenerateTasks}>
          <Play className="mr-2 h-4 w-4" />
          Generate Tasks
        </DropdownMenuItem>
        <DropdownMenuItem disabled={loading} onClick={() => toast.info("Edit not yet implemented")}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" disabled={loading} onClick={handleDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const columns: ColumnDef<CycleCountPlan>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column} title="Name" />,
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "method",
    header: "Method",
    cell: ({ row }) => <Badge variant="outline">{row.original.method.toUpperCase()}</Badge>,
  },
  {
    accessorKey: "frequency",
    header: "Frequency",
    cell: ({ row }) => <span className="capitalize">{row.original.frequency}</span>,
  },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.isActive ? "active" : "inactive"} />,
  },
  {
    accessorKey: "lastRunAt",
    header: ({ column }) => <SortableHeader column={column} title="Last Run" />,
    cell: ({ row }) =>
      row.original.lastRunAt ? format(new Date(row.original.lastRunAt), "MMM d, yyyy") : "-",
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsCell plan={row.original} />,
  },
];

export function CycleCountPlansTable({ data }: { data: CycleCountPlan[] }) {
  return (
    <DataTable columns={columns} data={data} searchKey="name" searchPlaceholder="Search plans..." />
  );
}
