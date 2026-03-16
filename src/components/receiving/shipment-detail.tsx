"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { updateShipmentStatus } from "@/modules/receiving/actions";
import { ReceiveLineDialog } from "./receive-line-dialog";
import { AddLineDialog } from "./add-line-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Truck, Package, ClipboardCheck, AlertTriangle } from "lucide-react";

interface ShipmentDetailProps {
  shipment: any;
}

const statusFlow: Record<string, { next: string; label: string }> = {
  draft: { next: "expected", label: "Mark Expected" },
  expected: { next: "arrived", label: "Mark Arrived" },
  arrived: { next: "receiving", label: "Start Receiving" },
  receiving: { next: "completed", label: "Complete Receiving" },
  inspection: { next: "completed", label: "Complete Receiving" },
};

export function ShipmentDetail({ shipment }: ShipmentDetailProps) {
  const [receiving, setReceiving] = useState(false);
  const [addingLine, setAddingLine] = useState(false);

  const flow = statusFlow[shipment.status];

  async function handleStatusChange() {
    if (!flow) return;
    try {
      await updateShipmentStatus(shipment.id, flow.next as any);
      toast.success(`Shipment ${flow.label.toLowerCase()}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const totalExpected = shipment.lines.reduce((s: number, l: any) => s + l.expectedQty, 0);
  const totalReceived = shipment.lines.reduce((s: number, l: any) => s + l.receivedQty, 0);

  return (
    <div className="space-y-6">
      <PageHeader title={shipment.shipmentNumber}>
        <div className="flex items-center gap-2">
          <StatusBadge status={shipment.status} />
          {flow && shipment.status !== "completed" && shipment.status !== "cancelled" && (
            <Button onClick={handleStatusChange}>{flow.label}</Button>
          )}
        </div>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Client</span>
            </div>
            <p className="mt-1 font-medium">{shipment.client.name}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Lines</span>
            </div>
            <p className="mt-1 font-medium">{shipment.lines.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Received</span>
            </div>
            <p className="mt-1 font-medium">
              {totalReceived} / {totalExpected}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Discrepancies</span>
            </div>
            <p className="mt-1 font-medium">{shipment.discrepancies.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Detail info */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 sm:grid-cols-3 text-sm">
            <div>
              <span className="text-muted-foreground">Carrier:</span> {shipment.carrier || "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Tracking:</span>{" "}
              {shipment.trackingNumber || "-"}
            </div>
            <div>
              <span className="text-muted-foreground">BOL:</span> {shipment.bolNumber || "-"}
            </div>
            <div>
              <span className="text-muted-foreground">PO:</span> {shipment.poNumber || "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Expected:</span>{" "}
              {shipment.expectedDate ? format(new Date(shipment.expectedDate), "MMM d, yyyy") : "-"}
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>{" "}
              {format(new Date(shipment.createdAt), "MMM d, yyyy")}
            </div>
          </div>
          {shipment.notes && <p className="mt-4 text-sm text-muted-foreground">{shipment.notes}</p>}
        </CardContent>
      </Card>

      <Tabs defaultValue="lines">
        <TabsList>
          <TabsTrigger value="lines">Lines ({shipment.lines.length})</TabsTrigger>
          <TabsTrigger value="transactions">
            Transactions ({shipment.transactions.length})
          </TabsTrigger>
          <TabsTrigger value="discrepancies">
            Discrepancies ({shipment.discrepancies.length})
          </TabsTrigger>
          <TabsTrigger value="documents">Documents ({shipment.documents.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="lines" className="space-y-4">
          <div className="flex justify-end gap-2">
            {["draft", "expected"].includes(shipment.status) && (
              <Button variant="outline" onClick={() => setAddingLine(true)}>
                Add Line
              </Button>
            )}
            {["arrived", "receiving"].includes(shipment.status) && (
              <Button onClick={() => setReceiving(true)}>Receive Items</Button>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipment.lines.map((line: any) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-medium">{line.product.name}</TableCell>
                    <TableCell>{line.product.sku}</TableCell>
                    <TableCell className="text-right">{line.expectedQty}</TableCell>
                    <TableCell className="text-right">{line.receivedQty}</TableCell>
                    <TableCell>{line.uom}</TableCell>
                    <TableCell>{line.lotNumber || "-"}</TableCell>
                    <TableCell>
                      {line.receivedQty >= line.expectedQty ? (
                        <Badge className="bg-green-100 text-green-700">Complete</Badge>
                      ) : line.receivedQty > 0 ? (
                        <Badge className="bg-yellow-100 text-yellow-700">Partial</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-700">Pending</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Bin</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>Received At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipment.transactions.map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.line.product.sku}</TableCell>
                    <TableCell className="text-right">{tx.quantity}</TableCell>
                    <TableCell>
                      <StatusBadge status={tx.condition} />
                    </TableCell>
                    <TableCell>{tx.bin?.barcode || "-"}</TableCell>
                    <TableCell>{tx.lotNumber || "-"}</TableCell>
                    <TableCell>{format(new Date(tx.receivedAt), "MMM d, yyyy HH:mm")}</TableCell>
                  </TableRow>
                ))}
                {shipment.transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No receiving transactions yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="discrepancies">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipment.discrepancies.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <StatusBadge status={d.type} />
                    </TableCell>
                    <TableCell>{d.description}</TableCell>
                    <TableCell>{d.expectedQty ?? "-"}</TableCell>
                    <TableCell>{d.actualQty ?? "-"}</TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {shipment.discrepancies.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No discrepancies
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <p className="text-sm text-muted-foreground">
            {shipment.documents.length === 0
              ? "No documents uploaded"
              : `${shipment.documents.length} document(s)`}
          </p>
        </TabsContent>
      </Tabs>

      {receiving && (
        <ReceiveLineDialog
          shipmentId={shipment.id}
          lines={shipment.lines}
          open={receiving}
          onClose={() => setReceiving(false)}
        />
      )}

      {addingLine && (
        <AddLineDialog
          shipmentId={shipment.id}
          clientId={shipment.clientId}
          open={addingLine}
          onClose={() => setAddingLine(false)}
        />
      )}
    </div>
  );
}
