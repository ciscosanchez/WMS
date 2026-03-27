"use client";

import { useEffect, useState } from "react";
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
  const [products, setProducts] = useState<ProductOption[]>([]);
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
      toast.success("Line added");
      setProductId("");
      setExpectedQty(1);
      setUom("EA");
      setLotNumber("");
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to add line");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Line Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Product *</Label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} - {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Expected Quantity *</Label>
            <Input
              type="number"
              min={1}
              value={expectedQty}
              onChange={(e) => setExpectedQty(parseInt(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <Label>Requested UOM *</Label>
            <select
              value={uom}
              onChange={(e) => setUom(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              disabled={!selectedProduct}
            >
              {!selectedProduct ? <option value="">Select product first...</option> : null}
              {uomChoices.map((choice) => (
                <option key={choice.code} value={choice.code}>
                  {choice.code}
                </option>
              ))}
            </select>
            {conversionPreview ? (
              <p className="text-xs text-muted-foreground">
                Will store as {conversionPreview.baseQuantity} {conversionPreview.baseUom}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Lot Number</Label>
            <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
          </div>

          {attributeDefinitions.length > 0 && (
            <div className="space-y-4 rounded-md border p-3">
              <div className="text-sm font-medium">Operational Attributes</div>
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
                      <span>Enabled</span>
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
                      <option value="">Select value...</option>
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
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !productId}>
              {loading ? "Adding..." : "Add Line"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
