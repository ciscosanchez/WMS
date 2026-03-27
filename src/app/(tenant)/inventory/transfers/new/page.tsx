"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createTransferOrder } from "@/modules/transfers/actions";
import { getWarehouses } from "@/modules/warehouse/actions";
import { getProducts } from "@/modules/products/actions";

type WarehouseOption = Awaited<ReturnType<typeof getWarehouses>>[number];
type ProductOption = Awaited<ReturnType<typeof getProducts>>[number];

type TransferLine = {
  productId: string;
  quantity: number;
  lotNumber: string;
};

export default function NewTransferPage() {
  const t = useTranslations("tenant.inventoryTransfers");
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<TransferLine[]>([
    { productId: "", quantity: 1, lotNumber: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getWarehouses().then(setWarehouses);
    getProducts().then(setProducts);
  }, []);

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (product) =>
        product.sku.toLowerCase().includes(query) || product.name.toLowerCase().includes(query)
    );
  }, [productSearch, products]);

  function addLine() {
    setLines((current) => [...current, { productId: "", quantity: 1, lotNumber: "" }]);
  }

  function updateLine(index: number, next: Partial<TransferLine>) {
    setLines((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...next } : line))
    );
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const validLines = lines.filter((line) => line.productId && line.quantity > 0);
      if (validLines.length === 0) {
        setError(t("lineRequired"));
        setSubmitting(false);
        return;
      }

      await createTransferOrder(
        { fromWarehouseId, toWarehouseId, notes: notes || undefined },
        validLines
      );
      router.push("/inventory/transfers");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failedCreate"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("newTransfer")} description={t("newTransferDesc")} />

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("transferDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("fromWarehouse")}</Label>
              <select
                value={fromWarehouseId}
                onChange={(e) => setFromWarehouseId(e.target.value)}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">{t("selectWarehouse")}</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("toWarehouse")}</Label>
              <select
                value={toWarehouseId}
                onChange={(e) => setToWarehouseId(e.target.value)}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">{t("selectWarehouse")}</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("notes")}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={t("notesPlaceholder")}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{t("lineItems")}</CardTitle>
              <Button type="button" variant="outline" onClick={addLine}>
                {t("addLine")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("searchProducts")}</Label>
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={t("searchProductsPlaceholder")}
              />
            </div>

            {lines.map((line, index) => (
              <div
                key={`${index}-${line.productId}`}
                className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[2fr_120px_1fr_auto]"
              >
                <div className="space-y-2">
                  <Label>{t("product")}</Label>
                  <select
                    value={line.productId}
                    onChange={(e) => updateLine(index, { productId: e.target.value })}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="">{t("selectProduct")}</option>
                    {filteredProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.sku} - {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{t("quantity")}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(index, { quantity: parseInt(e.target.value, 10) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("lotNumber")}</Label>
                  <Input
                    value={line.lotNumber}
                    onChange={(e) => updateLine(index, { lotNumber: e.target.value })}
                    placeholder={t("lotNumberPlaceholder")}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeLine(index)}
                    disabled={lines.length === 1}
                  >
                    {t("remove")}
                  </Button>
                </div>
              </div>
            ))}

            {filteredProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noProductsMatch")}</p>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? t("creating") : t("createTransfer")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
