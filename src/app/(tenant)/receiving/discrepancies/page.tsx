import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { getDiscrepancies } from "@/modules/receiving/actions";

export default async function DiscrepanciesPage() {
  const discrepancies = await getDiscrepancies();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receiving Discrepancies"
        description="Shortages, overages, and damage reports"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Shipment</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Actual</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {discrepancies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No discrepancies recorded
                </TableCell>
              </TableRow>
            ) : (
              discrepancies.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    {d.shipment?.shipmentNumber ?? "-"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={d.type} />
                  </TableCell>
                  <TableCell>{d.description}</TableCell>
                  <TableCell>{d.expectedQty ?? "-"}</TableCell>
                  <TableCell>{d.actualQty ?? "-"}</TableCell>
                  <TableCell>
                    <StatusBadge status={d.status} />
                  </TableCell>
                  <TableCell>{format(d.createdAt, "MMM d, yyyy")}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
