"use client";

import type { Column } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SortableHeaderProps<TData> {
  column: Column<TData>;
  title: string;
}

export function SortableHeader<TData>({ column, title }: SortableHeaderProps<TData>) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {title}
      <ArrowUpDown className="ml-2 h-3 w-3" />
    </Button>
  );
}
