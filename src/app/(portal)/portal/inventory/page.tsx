"use client";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@tanstack/react-table";

type PortalInventory = {
  id: string;
  sku: string;
  name: string;
  uom: string;
  onHand: number;
  allocated: number;
  available: number;
  location: string;
};

const mockInventory: PortalInventory[] = [
  {
    id: "1",
    sku: "WIDGET-001",
    name: "Standard Widget",
    uom: "EA",
    onHand: 150,
    allocated: 20,
    available: 130,
    location: "Zone A",
  },
  {
    id: "2",
    sku: "GADGET-001",
    name: "Premium Gadget",
    uom: "EA",
    onHand: 75,
    allocated: 0,
    available: 75,
    location: "Zone A",
  },
  {
    id: "3",
    sku: "BOLT-M8X40",
    name: "M8x40 Hex Bolt",
    uom: "EA",
    onHand: 500,
    allocated: 100,
    available: 400,
    location: "Zone B",
  },
  {
    id: "4",
    sku: "VALVE-BV2",
    name: '2" Ball Valve',
    uom: "EA",
    onHand: 30,
    allocated: 5,
    available: 25,
    location: "Zone A",
  },
  {
    id: "5",
    sku: "PIPE-SCH40",
    name: 'Schedule 40 Steel Pipe 2"',
    uom: "FT",
    onHand: 200,
    allocated: 0,
    available: 200,
    location: "Zone B",
  },
];

const columns: ColumnDef<PortalInventory>[] = [
  {
    accessorKey: "sku",
    header: "SKU",
    cell: ({ row }) => <span className="font-mono text-sm">{row.getValue("sku")}</span>,
  },
  {
    accessorKey: "name",
    header: "Product Name",
  },
  {
    accessorKey: "uom",
    header: "UOM",
  },
  {
    accessorKey: "onHand",
    header: "On Hand",
    cell: ({ row }) => (
      <span className="font-medium">{(row.getValue("onHand") as number).toLocaleString()}</span>
    ),
  },
  {
    accessorKey: "allocated",
    header: "Allocated",
    cell: ({ row }) => {
      const val = row.getValue("allocated") as number;
      return (
        <span className={val > 0 ? "text-orange-600 font-medium" : "text-muted-foreground"}>
          {val.toLocaleString()}
        </span>
      );
    },
  },
  {
    accessorKey: "available",
    header: "Available",
    cell: ({ row }) => {
      const val = row.getValue("available") as number;
      return (
        <span className={val > 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
          {val.toLocaleString()}
        </span>
      );
    },
  },
  {
    accessorKey: "location",
    header: "Location",
  },
];

export default function PortalInventoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Inventory"
        description="Current stock levels for your products"
      />

      <DataTable
        columns={columns}
        data={mockInventory}
        searchKey="name"
        searchPlaceholder="Search products..."
      />
    </div>
  );
}
