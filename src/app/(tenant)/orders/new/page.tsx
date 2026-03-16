"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const mockClients = [
  { id: "1", code: "ACME", name: "Acme Corporation" },
  { id: "2", code: "GLOBEX", name: "Globex Industries" },
  { id: "3", code: "INITECH", name: "Initech Logistics" },
  { id: "5", code: "STARK", name: "Stark Shipping Co" },
];

const mockProducts = [
  { id: "1", sku: "WIDGET-001", name: "Standard Widget", clientId: "1" },
  { id: "2", sku: "GADGET-001", name: "Premium Gadget", clientId: "1" },
  { id: "3", sku: "PART-A100", name: "Component Part A-100", clientId: "1" },
  { id: "4", sku: "BOLT-M8X40", name: "M8x40 Hex Bolt", clientId: "2" },
  { id: "5", sku: "PIPE-SCH40", name: 'Schedule 40 Steel Pipe 2"', clientId: "2" },
  { id: "6", sku: "VALVE-BV2", name: '2" Ball Valve', clientId: "3" },
];

interface OrderLine {
  id: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
}

export default function NewOrderPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [priority, setPriority] = useState("standard");
  const [shipToName, setShipToName] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");
  const [shipToCity, setShipToCity] = useState("");
  const [shipToState, setShipToState] = useState("");
  const [shipToZip, setShipToZip] = useState("");
  const [shipToCountry, setShipToCountry] = useState("US");
  const [shipToPhone, setShipToPhone] = useState("");
  const [shipToEmail, setShipToEmail] = useState("");
  const [shippingMethod, setShippingMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const availableProducts = mockProducts.filter(
    (p) => p.clientId === clientId && !lines.find((l) => l.productId === p.id)
  );

  function addLine() {
    const product = mockProducts.find((p) => p.id === addProductId);
    if (!product) return;
    setLines([
      ...lines,
      {
        id: `line-${Date.now()}`,
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantity: addQty,
      },
    ]);
    setAddProductId("");
    setAddQty(1);
  }

  function removeLine(lineId: string) {
    setLines(lines.filter((l) => l.id !== lineId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    // Simulated — will wire to server action when DB is connected
    await new Promise((r) => setTimeout(r, 500));
    toast.success("Order created");
    router.push("/orders");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Order" description="Create a fulfillment order" />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        {/* Client & Priority */}
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Client *</Label>
              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setLines([]);
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                required
              >
                <option value="">Select client...</option>
                {mockClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="standard">Standard</option>
                <option value="expedited">Expedited</option>
                <option value="rush">Rush</option>
                <option value="same_day">Same Day</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Shipping Method</Label>
              <select
                value={shippingMethod}
                onChange={(e) => setShippingMethod(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Best available</option>
                <option value="ground">Ground</option>
                <option value="2day">2-Day</option>
                <option value="overnight">Overnight</option>
                <option value="ltl">LTL Freight</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Ship To */}
        <Card>
          <CardHeader>
            <CardTitle>Ship To</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Name *</Label>
              <Input
                value={shipToName}
                onChange={(e) => setShipToName(e.target.value)}
                placeholder="Jane Cooper"
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Address *</Label>
              <Input
                value={shipToAddress}
                onChange={(e) => setShipToAddress(e.target.value)}
                placeholder="123 Main St"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>City *</Label>
              <Input value={shipToCity} onChange={(e) => setShipToCity(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>State *</Label>
                <Input
                  value={shipToState}
                  onChange={(e) => setShipToState(e.target.value)}
                  placeholder="TX"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Zip *</Label>
                <Input
                  value={shipToZip}
                  onChange={(e) => setShipToZip(e.target.value)}
                  placeholder="77001"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={shipToPhone} onChange={(e) => setShipToPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={shipToEmail}
                onChange={(e) => setShipToEmail(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              {lines.length > 0 && <Badge variant="secondary">{lines.length} items</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!clientId && (
              <p className="text-sm text-muted-foreground">
                Select a client first to add products.
              </p>
            )}

            {clientId && (
              <div className="flex gap-2">
                <select
                  value={addProductId}
                  onChange={(e) => setAddProductId(e.target.value)}
                  className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">Select product...</option>
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} - {p.name}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={1}
                  value={addQty}
                  onChange={(e) => setAddQty(parseInt(e.target.value) || 1)}
                  className="w-20"
                />
                <Button type="button" variant="outline" onClick={addLine} disabled={!addProductId}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}

            {lines.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono">{line.sku}</TableCell>
                      <TableCell>{line.name}</TableCell>
                      <TableCell className="text-right font-medium">{line.quantity}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special instructions, packing requirements..."
              rows={3}
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={submitting || !clientId || !shipToName || lines.length === 0}
          >
            {submitting ? "Creating..." : "Create Order"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
