import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, FileText, Warehouse, PackageCheck, Download } from "lucide-react";
import { format } from "date-fns";

const mockInvoices = [
  {
    id: "1",
    invoiceNumber: "INV-2026-0042",
    period: "Feb 2026",
    amount: 4250.0,
    status: "paid",
    dueDate: new Date("2026-03-01"),
  },
  {
    id: "2",
    invoiceNumber: "INV-2026-0056",
    period: "Mar 1-15 2026",
    amount: 2180.5,
    status: "pending",
    dueDate: new Date("2026-03-31"),
  },
  {
    id: "3",
    invoiceNumber: "INV-2026-0034",
    period: "Jan 2026",
    amount: 3875.0,
    status: "paid",
    dueDate: new Date("2026-02-01"),
  },
  {
    id: "4",
    invoiceNumber: "INV-2025-0128",
    period: "Dec 2025",
    amount: 5100.75,
    status: "overdue",
    dueDate: new Date("2026-01-01"),
  },
];

const statusMap: Record<string, string> = {
  paid: "completed",
  pending: "pending",
  overdue: "failed",
};

export default function PortalBillingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Invoices and charges for your account" />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          title="Current Balance"
          value="$7,281.25"
          description="Outstanding amount"
          icon={DollarSign}
        />
        <KpiCard
          title="Last Invoice"
          value="$2,180.50"
          description="INV-2026-0056"
          icon={FileText}
        />
        <KpiCard
          title="Storage Charges (MTD)"
          value="$1,450.00"
          description="145 pallets @ $10/pallet"
          icon={Warehouse}
        />
        <KpiCard
          title="Handling Charges (MTD)"
          value="$730.50"
          description="243 units processed"
          icon={PackageCheck}
        />
      </div>

      {/* Invoices Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockInvoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                <TableCell>{invoice.period}</TableCell>
                <TableCell className="text-right font-medium">
                  ${invoice.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  <StatusBadge status={statusMap[invoice.status] ?? invoice.status} />
                </TableCell>
                <TableCell>{format(invoice.dueDate, "MMM d, yyyy")}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">
                    <Download className="mr-1 h-4 w-4" />
                    PDF
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
