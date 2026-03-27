"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addShipmentLine } from "@/modules/receiving/actions";
import { getOperationalAttributeDefinitions } from "@/modules/attributes/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type AttributeDefinition = Awaited<ReturnType<typeof getOperationalAttributeDefinitions>>[number];
type AttributeValue = string | boolean | string[];
type AttributeOption = AttributeDefinition["options"][number];

interface AddLineDialogProps {
  shipmentId: string;
  clientId: string;
  open: boolean;
  onClose: () => void;
}

export function AddLineDialog({
  shipmentId,
  clientId: _clientId,
  open,
  onClose,
}: AddLineDialogProps) {
  const [products] = useState([
    { id: "4", sku: "BOLT-M8X40", name: "M8x40 Hex Bolt" },
    { id: "5", sku: "PIPE-SCH40", name: "Schedule 40 Steel Pipe 2in" },
    { id: "6", sku: "VALVE-BV2", name: "2in Ball Valve" },
  ]);
  const [productId, setProductId] = useState("");
  const [expectedQty, setExpectedQty] = useState(1);
  const [lotNumber, setLotNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, AttributeValue>>({});

  useEffect(() => {
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
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await addShipmentLine(shipmentId, {
        productId,
        expectedQty,
        lotNumber: lotNumber || null,
        operationalAttributes: attributeDefinitions.map((definition) => ({
          definitionId: definition.id,
          value: attributeValues[definition.id] ?? null,
        })),
      });
      toast.success("Line added");
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
