"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createPutawayRule, deletePutawayRule } from "@/modules/inventory/rules";

interface PutawayRule {
  id: string;
  productId: string | null;
  productSku: string | null;
  productName: string | null;
  zoneCode: string | null;
  strategy: string;
  priority: number;
  isActive: boolean;
}

interface Props {
  initialRules: PutawayRule[];
  products: { id: string; sku: string; name: string }[];
  zones: { code: string; name: string }[];
}

const strategies = [
  { value: "fixed", label: "Fixed" },
  { value: "zone", label: "Zone" },
  { value: "closest_empty", label: "Closest Empty" },
  { value: "consolidate", label: "Consolidate" },
];

const strategyColors: Record<string, "default" | "secondary" | "outline"> = {
  fixed: "default",
  zone: "secondary",
  closest_empty: "outline",
  consolidate: "secondary",
};

export function PutawayRulesClient({ initialRules, products, zones }: Props) {
  const [rules, setRules] = useState<PutawayRule[]>(initialRules);
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formProductId, setFormProductId] = useState("");
  const [formZoneCode, setFormZoneCode] = useState("");
  const [formStrategy, setFormStrategy] = useState("closest_empty");
  const [formPriority, setFormPriority] = useState("5");

  function resetForm() {
    setFormProductId("");
    setFormZoneCode("");
    setFormStrategy("closest_empty");
    setFormPriority("5");
  }

  async function addRule() {
    setSubmitting(true);
    try {
      const product = products.find((p) => p.id === formProductId);
      const result = await createPutawayRule({
        productId: formProductId || null,
        zoneCode: formZoneCode || null,
        strategy: formStrategy,
        priority: parseInt(formPriority, 10) || 5,
      });

      setRules((prev) => [
        ...prev,
        {
          id: result.id,
          productId: formProductId || null,
          productSku: product?.sku ?? null,
          productName: product?.name ?? null,
          zoneCode: formZoneCode || null,
          strategy: formStrategy,
          priority: parseInt(formPriority, 10) || 5,
          isActive: true,
        },
      ]);
      setAddOpen(false);
      resetForm();
      toast.success("Putaway rule added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create rule");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePutawayRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      toast.success("Putaway rule deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete rule");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Putaway Rules"
        description="Configure how received items are assigned to storage bins"
      >
        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4" />
            Add Rule
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Putaway Rule</DialogTitle>
              <DialogDescription>
                Define how inventory should be placed in the warehouse.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="rule-product" className="text-sm font-medium">
                  Product (optional)
                </label>
                <select
                  id="rule-product"
                  value={formProductId}
                  onChange={(e) => setFormProductId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All products</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} - {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="rule-zone" className="text-sm font-medium">
                  Zone (optional)
                </label>
                <select
                  id="rule-zone"
                  value={formZoneCode}
                  onChange={(e) => setFormZoneCode(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Any zone</option>
                  {zones.map((z) => (
                    <option key={z.code} value={z.code}>
                      {z.code} - {z.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="rule-strategy" className="text-sm font-medium">
                  Strategy
                </label>
                <select
                  id="rule-strategy"
                  value={formStrategy}
                  onChange={(e) => setFormStrategy(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {strategies.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="rule-priority" className="text-sm font-medium">
                  Priority
                </label>
                <input
                  id="rule-priority"
                  type="number"
                  min={1}
                  max={99}
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
                <p className="text-xs text-muted-foreground">Lower numbers are evaluated first.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={addRule} disabled={submitting}>
                {submitting ? "Adding..." : "Add Rule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Zone</TableHead>
              <TableHead>Strategy</TableHead>
              <TableHead className="text-center">Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No putaway rules configured. Add a rule to get started.
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    {rule.productSku ? (
                      <div>
                        <span className="font-medium">{rule.productSku}</span>
                        <p className="text-xs text-muted-foreground">{rule.productName}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">All products</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {rule.zoneCode ? (
                      <span className="font-mono">{rule.zoneCode}</span>
                    ) : (
                      <span className="text-muted-foreground">Any</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={strategyColors[rule.strategy] ?? "outline"}>
                      {rule.strategy.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{rule.priority}</TableCell>
                  <TableCell>
                    <Badge variant={rule.isActive ? "default" : "outline"}>
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(rule.id)}
                      aria-label="Delete rule"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
