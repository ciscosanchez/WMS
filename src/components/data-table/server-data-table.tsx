"use client";

import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

interface ServerDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  totalCount: number;
  pageSize: number;
  currentPage: number;
  searchValue?: string;
  searchPlaceholder?: string;
}

export function ServerDataTable<TData, TValue>({
  columns,
  data,
  totalCount,
  pageSize,
  currentPage,
  searchValue = "",
  searchPlaceholder = "Search...",
}: ServerDataTableProps<TData, TValue>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState(searchValue);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const buildUrl = useCallback(
    (params: Record<string, string | number | undefined>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === "" || (key === "page" && value === 1)) {
          sp.delete(key);
        } else {
          sp.set(key, String(value));
        }
      }
      const qs = sp.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams]
  );

  const handlePageChange = (page: number) => {
    router.push(buildUrl({ page }));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildUrl({ page: undefined, search: search || undefined }));
  };

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {rangeStart}-{rangeEnd} of {totalCount.toLocaleString()} results
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
