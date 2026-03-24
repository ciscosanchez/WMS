"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createRma } from "@/modules/returns/actions";
import { getClients } from "@/modules/clients/actions";
import { getOrders } from "@/modules/orders/actions";
import { getProducts } from "@/modules/products/actions";
import { useTranslations } from "next-intl";

interface LineItem {
  productId: string;
  expectedQty: number;
}

export default function NewReturnPage() {
  const router = useRouter();
  const t = useTranslations("tenant.returns");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clients, setClients] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orders, setOrders] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [products, setProducts] = useState<any[]>([]);

  const [clientId, setClientId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([{ productId: "", expectedQty: 1 }]);
  const [submitting, setSubmitting] = useState(false);

  // Load clients on mount
  useEffect(() => {
    getClients().then(setClients);
  }, []);

  // Load orders and products when client changes
  useEffect(() => {
    if (clientId) {
      getOrders().then((allOrders) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const filtered = allOrders.filter((o: any) => o.clientId === clientId);
        setOrders(filtered);
      });
      getProducts(clientId).then(setProducts);
    } else {
      setOrders([]);
      setProducts([]);
    }
    setOrderId("");
  }, [clientId]);

  function addLine() {
    setLines((prev) => [...prev, { productId: "", expectedQty: 1 }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof LineItem, value: string | number) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!clientId) {
      toast.error(t("clientRequired"));
      return;
    }
    if (!reason.trim()) {
      toast.error(t("reasonRequired"));
      return;
    }
    if (lines.length === 0 || lines.some((l) => !l.productId)) {
      toast.error(t("linesRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const result = await createRma(
        {
          clientId,
          orderId: orderId || null,
          reason,
          notes: notes || null,
        },
        lines.map((l) => ({
          productId: l.productId,
          expectedQty: l.expectedQty,
        }))
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(t("rmaCreated", { number: result.rmaNumber ?? "" }));
      router.push(`/returns/${result.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("failedCreate"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("newReturn")} description={t("newReturnDesc")} />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>{t("returnDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clientId">{t("client")} *</Label>
              <select
                id="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{t("selectClient")}</option>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {clients.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderId">{t("orderNumber")}</Label>
              <select
                id="orderId"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                disabled={!clientId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <option value="">{t("selectOrder")}</option>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {orders.map((o: any) => (
                  <option key={o.id} value={o.id}>
                    {o.orderNumber}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="reason">{t("reason")} *</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("reasonPlaceholder")}
                rows={3}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">{t("notes")}</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("notesPlaceholder")}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {t("returnLines")}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLine}
                disabled={!clientId}
              >
                <Plus className="mr-1 h-4 w-4" />
                {t("addLine")}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lines.map((line, index) => (
              <div key={index} className="flex items-end gap-3">
                <div className="flex-1 space-y-2">
                  <Label>{t("product")} *</Label>
                  <select
                    value={line.productId}
                    onChange={(e) => updateLine(index, "productId", e.target.value)}
                    disabled={!clientId}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="">{t("selectProduct")}</option>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {products.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-32 space-y-2">
                  <Label>{t("expectedQty")}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={line.expectedQty}
                    onChange={(e) =>
                      updateLine(index, "expectedQty", parseInt(e.target.value) || 1)
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLine(index)}
                  disabled={lines.length <= 1}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? t("creating") : t("createReturn")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
