"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { assignTaskToOperator } from "@/modules/dashboard/manager-actions";

interface Props {
  taskId: string;
  operators: Array<{ userId: string; name: string }>;
}

export function AssignTaskButton({ taskId, operators }: Props) {
  const [selectedOp, setSelectedOp] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function handleAssign() {
    if (!selectedOp) return;
    startTransition(async () => {
      try {
        await assignTaskToOperator(taskId, selectedOp);
        toast.success("Task assigned");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to assign");
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Select value={selectedOp} onValueChange={(v) => setSelectedOp(v ?? "")}>
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue placeholder="Assign to..." />
        </SelectTrigger>
        <SelectContent>
          {operators.map((op) => (
            <SelectItem key={op.userId} value={op.userId} className="text-xs">
              {op.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        disabled={!selectedOp || isPending}
        onClick={handleAssign}
      >
        {isPending ? "..." : "Assign"}
      </Button>
    </div>
  );
}
