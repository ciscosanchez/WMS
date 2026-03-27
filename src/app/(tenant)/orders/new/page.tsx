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
import { getOperationalAttributeDefinitions } from "@/modules/attributes/actions";
import { useTranslations } from "next-intl";
import { convertQuantityToBaseUom, getProductUomChoices } from "@/modules/products/uom";

interface OrderLine {
  id: string;
  productId: string;
  sku: string;
  name: string;
  requestedQuantity: number;
  requestedUom: string;
  baseQuantity: number;
  baseUom: string;
  operationalAttributes: Array<{ definitionId: string; label: string; value: string }>;
}

interface AttributeDefinition {
  id: string;
  label: string;
  dataType: string;
  options?: Array<{ value: string; label: string }>;
}

export default function NewOrderPage() {
  const t = useTranslations("tenant.orders");
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clients, setClients] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [products, setProducts] = useState<any[]>([]);
  const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([]);
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
  const [addUom, setAddUom] = useState("EA");
  const [draftAttributeValues, setDraftAttributeValues] = useState<
    Record<string, string | boolean>
  >({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getClients().then(setClients);
    getProducts().then(setProducts);
    getOperationalAttributeDefinitions("order_line", "orders:write").then(setAttributeDefinitions);
  }, []);

  const availableProducts = products.filter(
    (p) => p.clientId === clientId && !lines.find((l) => l.productId === p.id)
  );
  const selectedProduct = products.find((p) => p.id === addProductId);
  const selectedUomChoices = selectedProduct ? getProductUomChoices(selectedProduct) : [];
  const orderQuantityPreview =
    selectedProduct && addQty > 0 ? convertQuantityToBaseUom(selectedProduct, addQty, addUom) : null;

  useEffect(() => {
    if (selectedProduct) {
      setAddUom(selectedProduct.baseUom);
    } else {
      setAddUom("EA");
    }
  }, [selectedProduct]);

  function addLine() {
    const product = products.find((p) => p.id === addProductId);
    if (!product) return;
    const quantityResolution = convertQuantityToBaseUom(product, addQty, addUom);
    const operationalAttributes = attributeDefinitions
      .map((definition) => {
        const rawValue = draftAttributeValues[definition.id];
        if (
          rawValue === undefined ||
          rawValue === null ||
          rawValue === "" ||
          (Array.isArray(rawValue) && rawValue.length === 0)
        ) {
          return null;
        }
        const displayValue =
          typeof rawValue === "boolean" ? (rawValue ? "Yes" : "No") : String(rawValue);
        return {
          definitionId: definition.id,
          label: definition.label,
          value: displayValue,
        };
      })
      .filter(Boolean) as Array<{ definitionId: string; label: string; value: string }>;

    setLines([
      ...lines,
      {
        id: `line-${Date.now()}`,
        productId: product.id,
        sku: product.sku,
        name: product.name,
        requestedQuantity: addQty,
        requestedUom: quantityResolution.requestedUom,
        baseQuantity: quantityResolution.baseQuantity,
        baseUom: quantityResolution.baseUom,
        operationalAttributes,
      },
    ]);
    setAddProductId("");
    setAddQty(1);
    setAddUom("EA");
    setDraftAttributeValues({});
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
        quantity: l.requestedQuantity,
        uom: l.requestedUom,
        operationalAttributes: l.operationalAttributes.map((attribute) => ({
          definitionId: attribute.definitionId,
          value: attribute.value,
        })),
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
              <div className="space-y-4 rounded-lg border p-4">
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
                  <select
                    value={addUom}
                    onChange={(e) => setAddUom(e.target.value)}
                    className="flex h-9 w-28 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    disabled={!selectedProduct}
                  >
                    {!selectedProduct ? <option value="">UOM</option> : null}
                    {selectedUomChoices.map((choice) => (
                      <option key={choice.code} value={choice.code}>
                        {choice.code}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addLine}
                    disabled={!addProductId}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {orderQuantityPreview ? (
                  <p className="text-xs text-muted-foreground">
                    Will allocate as {orderQuantityPreview.baseQuantity} {orderQuantityPreview.baseUom}
                  </p>
                ) : null}

                {attributeDefinitions.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {attributeDefinitions.map((definition) => (
                      <div key={definition.id} className="space-y-2">
                        <Label>{definition.label}</Label>
                        {definition.dataType === "boolean" ? (
                          <select
                            value={String(draftAttributeValues[definition.id] ?? "")}
                            onChange={(e) =>
                              setDraftAttributeValues((current) => ({
                                ...current,
                                [definition.id]:
                                  e.target.value === "" ? "" : e.target.value === "true",
                              }))
                            }
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                          >
                            <option value="">Select...</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        ) : definition.dataType === "single_select" ? (
                          <select
                            value={String(draftAttributeValues[definition.id] ?? "")}
                            onChange={(e) =>
                              setDraftAttributeValues((current) => ({
                                ...current,
                                [definition.id]: e.target.value,
                              }))
                            }
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                          >
                            <option value="">Select...</option>
                            {(definition.options ?? []).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            type={
                              definition.dataType === "number" || definition.dataType === "currency"
                                ? "number"
                                : definition.dataType === "date"
                                  ? "date"
                                  : "text"
                            }
                            value={String(draftAttributeValues[definition.id] ?? "")}
                            onChange={(e) =>
                              setDraftAttributeValues((current) => ({
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
              </div>
            )}

            {lines.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("sku")}</TableHead>
                    <TableHead>{t("product")}</TableHead>
                    <TableHead className="text-right">{t("qty")}</TableHead>
                    <TableHead className="text-right">Base Qty</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono">{line.sku}</TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <div>{line.name}</div>
                          {line.operationalAttributes.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {line.operationalAttributes.map((attribute) => (
                                <Badge
                                  key={`${line.id}-${attribute.definitionId}`}
                                  variant="outline"
                                >
                                  {attribute.label}: {attribute.value}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {line.requestedQuantity} {line.requestedUom}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {line.baseQuantity} {line.baseUom}
                      </TableCell>
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
