"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addShipmentLine } from "@/modules/receiving/actions";
import { getOperationalAttributeDefinitions } from "@/modules/attributes/actions";
import { getProducts } from "@/modules/products/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { convertQuantityToBaseUom, getProductUomChoices } from "@/modules/products/uom";
import { useTranslations } from "next-intl";

type AttributeDefinition = Awaited<ReturnType<typeof getOperationalAttributeDefinitions>>[number];
type AttributeValue = string | boolean | string[];
type AttributeOption = AttributeDefinition["options"][number];
type ProductOption = Awaited<ReturnType<typeof getProducts>>[number];

interface AddLineDialogProps {
  shipmentId: string;
  clientId: string;
  open: boolean;
  onClose: () => void;
}

export function AddLineDialog({
  shipmentId,
  clientId,
  open,
  onClose,
}: AddLineDialogProps) {
  const t = useTranslations("tenant.receiving");
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [expectedQty, setExpectedQty] = useState(1);
  const [uom, setUom] = useState("EA");
  const [lotNumber, setLotNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, AttributeValue>>({});

  useEffect(() => {
    getProducts(clientId)
      .then((items) => setProducts(items))
      .catch(() => setProducts([]));
    getOperationalAttributeDefinitions("inbound_shipment_line", "receiving:write")
      .then((definitions: AttributeDefinition[]) => {
        setAttributeDefinitions(definitions);
        setAttributeValues(
          Object.fromEntries(
            definitions.map((definition) => [
              definition.id,
              definition.dataType === "boolean" ? false : "",
            ])
          )
        );
      })
      .catch(() => setAttributeDefinitions([]));
  }, [clientId]);

  const selectedProduct = products.find((product) => product.id === productId) ?? null;
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (product) =>
        product.sku.toLowerCase().includes(query) ||
        product.name.toLowerCase().includes(query)
    );
  }, [productSearch, products]);
  const uomChoices = selectedProduct ? getProductUomChoices(selectedProduct) : [];
  const conversionPreview =
    selectedProduct && expectedQty > 0
      ? convertQuantityToBaseUom(selectedProduct, expectedQty, uom)
      : null;

  useEffect(() => {
    if (!selectedProduct) {
      setUom("EA");
      return;
    }
    setUom(selectedProduct.baseUom);
  }, [selectedProduct]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await addShipmentLine(shipmentId, {
        productId,
        expectedQty,
        uom,
        lotNumber: lotNumber || null,
        operationalAttributes: attributeDefinitions.map((definition) => ({
          definitionId: definition.id,
          value: attributeValues[definition.id] ?? null,
        })),
      });
      toast.success(t("lineAdded"));
      setProductSearch("");
      setProductId("");
      setExpectedQty(1);
      setUom("EA");
      setLotNumber("");
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("failedAddLine"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("addLineItem")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("product")} *</Label>
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder={t("searchProducts")}
            />
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">{t("selectProduct")}</option>
              {filteredProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.name}
                </option>
              ))}
            </select>
            {filteredProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("noProductsMatch")}</p>
            ) : null}
            {selectedProduct ? (
              <p className="text-xs text-muted-foreground">
                {t("selectedProductSummary", {
                  sku: selectedProduct.sku,
                  baseUom: selectedProduct.baseUom,
                })}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>{t("expectedQuantity")} *</Label>
            <Input
              type="number"
              min={1}
              value={expectedQty}
              onChange={(e) => setExpectedQty(parseInt(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("requestedUom")} *</Label>
            <select
              value={uom}
              onChange={(e) => setUom(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              disabled={!selectedProduct}
            >
              {!selectedProduct ? <option value="">{t("selectProductFirst")}</option> : null}
              {uomChoices.map((choice) => (
                <option key={choice.code} value={choice.code}>
                  {choice.code}
                </option>
              ))}
            </select>
            {conversionPreview ? (
              <p className="text-xs text-muted-foreground">
                {t("baseQuantityPreview", {
                  quantity: conversionPreview.baseQuantity,
                  uom: conversionPreview.baseUom,
                })}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>{t("lotNumber")}</Label>
            <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
          </div>

          {attributeDefinitions.length > 0 && (
            <div className="space-y-4 rounded-md border p-3">
              <div className="text-sm font-medium">{t("operationalAttributes")}</div>
              {attributeDefinitions.map((definition) => (
                <div key={definition.id} className="space-y-2">
                  <Label>{definition.label}</Label>
                  {definition.dataType === "boolean" ? (
                    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <Checkbox
                        checked={Boolean(attributeValues[definition.id])}
                        onCheckedChange={(checked) =>
                          setAttributeValues((current) => ({
                            ...current,
                            [definition.id]: Boolean(checked),
                          }))
                        }
                      />
                      <span>{t("enabled")}</span>
                    </label>
                  ) : definition.dataType === "single_select" ? (
                    <select
                      value={String(attributeValues[definition.id] ?? "")}
                      onChange={(e) =>
                        setAttributeValues((current) => ({
                          ...current,
                          [definition.id]: e.target.value,
                        }))
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    >
                      <option value="">{t("selectValue")}</option>
                      {definition.options?.map((option: AttributeOption) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : definition.dataType === "multi_select" ? (
                    <Textarea
                      value={
                        Array.isArray(attributeValues[definition.id])
                          ? (attributeValues[definition.id] as string[]).join(", ")
                          : String(attributeValues[definition.id] ?? "")
                      }
                      onChange={(e) =>
                        setAttributeValues((current) => ({
                          ...current,
                          [definition.id]: e.target.value
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        }))
                      }
                      rows={2}
                    />
                  ) : (
                    <Input
                      type={
                        definition.dataType === "number" || definition.dataType === "currency"
                          ? "number"
                          : definition.dataType === "date"
                            ? "date"
                            : "text"
                      }
                      value={String(attributeValues[definition.id] ?? "")}
                      onChange={(e) =>
                        setAttributeValues((current) => ({
                          ...current,
                          [definition.id]: e.target.value,
                        }))
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={loading || !productId}>
              {loading ? t("adding") : t("addLine")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
