"use client";

import { useState, useEffect } from "react";
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
import { getClients } from "@/modules/clients/actions";
import { getProducts } from "@/modules/products/actions";
import { createOrder } from "@/modules/orders/actions";
import { useTranslations } from "next-intl";

interface OrderLine {
  id: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
}

export default function NewOrderPage() {
  const t = useTranslations("tenant.orders");
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clients, setClients] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [products, setProducts] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [priority, setPriority] = useState("standard");
  const [shipToName, setShipToName] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");
  const [shipToCity, setShipToCity] = useState("");
  const [shipToState, setShipToState] = useState("");
  const [shipToZip, setShipToZip] = useState("");
  const [shipToPhone, setShipToPhone] = useState("");
  const [shipToEmail, setShipToEmail] = useState("");
  const [shippingMethod, setShippingMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getClients().then(setClients);
    getProducts().then(setProducts);
  }, []);

  const availableProducts = products.filter(
    (p) => p.clientId === clientId && !lines.find((l) => l.productId === p.id)
  );

  function addLine() {
    const product = products.find((p) => p.id === addProductId);
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
    try {
      const orderData = {
        clientId,
        priority,
        shipToName,
        shipToAddress1: shipToAddress,
        shipToCity,
        shipToState,
        shipToZip,
        shipToCountry: "US",
        shipToPhone: shipToPhone || null,
        shipToEmail: shipToEmail || null,
        requestedService: shippingMethod || null,
        notes: notes || null,
      };
      const orderLines = lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
      }));
      const order = await createOrder(orderData, orderLines);
      toast.success(`Order ${order.orderNumber} created`);
      router.push("/orders");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("newOrder")} description={t("createOrder")} />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        {/* Client & Priority */}
        <Card>
          <CardHeader>
            <CardTitle>{t("orderDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("client")} *</Label>
              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  setLines([]);
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                required
              >
                <option value="">{t("selectClient")}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("priority")}</Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="standard">{t("standard")}</option>
                <option value="expedited">{t("expedited")}</option>
                <option value="rush">{t("rush")}</option>
                <option value="same_day">{t("sameDay")}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("shippingMethod")}</Label>
              <select
                value={shippingMethod}
                onChange={(e) => setShippingMethod(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">{t("bestAvailable")}</option>
                <option value="ground">{t("ground")}</option>
                <option value="2day">{t("twoDay")}</option>
                <option value="overnight">{t("overnight")}</option>
                <option value="ltl">{t("ltlFreight")}</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Ship To */}
        <Card>
          <CardHeader>
            <CardTitle>{t("shipTo")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("name")} *</Label>
              <Input
                value={shipToName}
                onChange={(e) => setShipToName(e.target.value)}
                placeholder="Jane Cooper"
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("address")} *</Label>
              <Input
                value={shipToAddress}
                onChange={(e) => setShipToAddress(e.target.value)}
                placeholder="123 Main St"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("city")} *</Label>
              <Input value={shipToCity} onChange={(e) => setShipToCity(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("state")} *</Label>
                <Input
                  value={shipToState}
                  onChange={(e) => setShipToState(e.target.value)}
                  placeholder="TX"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t("zip")} *</Label>
                <Input
                  value={shipToZip}
                  onChange={(e) => setShipToZip(e.target.value)}
                  placeholder="77001"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("phone")}</Label>
              <Input value={shipToPhone} onChange={(e) => setShipToPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("email")}</Label>
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
              <CardTitle>{t("lineItems")}</CardTitle>
              {lines.length > 0 && <Badge variant="secondary">{lines.length} items</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!clientId && <p className="text-sm text-muted-foreground">{t("selectClientFirst")}</p>}

            {clientId && (
              <div className="flex gap-2">
                <select
                  value={addProductId}
                  onChange={(e) => setAddProductId(e.target.value)}
                  className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">{t("selectProduct")}</option>
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
                    <TableHead>{t("sku")}</TableHead>
                    <TableHead>{t("product")}</TableHead>
                    <TableHead className="text-right">{t("qty")}</TableHead>
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
            <CardTitle>{t("notes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPlaceholder")}
              rows={3}
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={submitting || !clientId || !shipToName || lines.length === 0}
          >
            {submitting ? t("creating") : t("createOrder")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
