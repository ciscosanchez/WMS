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

interface PutawayRule {
  id: string;
  productId: string | null;
  productSku: string | null;
  productName: string | null;
  zoneCode: string | null;
  strategy: "fixed" | "zone" | "closest_empty" | "consolidate";
  priority: number;
  isActive: boolean;
}

const mockProducts = [
  { id: "1", sku: "WIDGET-001", name: "Standard Widget" },
  { id: "2", sku: "GADGET-001", name: "Premium Gadget" },
  { id: "3", sku: "PART-A100", name: "Component Part A-100" },
  { id: "4", sku: "BOLT-M8X40", name: "M8x40 Hex Bolt" },
  { id: "5", sku: "PIPE-SCH40", name: 'Schedule 40 Steel Pipe 2"' },
  { id: "6", sku: "VALVE-BV2", name: '2" Ball Valve' },
];

const mockZones = [
  { code: "A", name: "Zone A - General Storage" },
  { code: "B", name: "Zone B - Bulk Storage" },
  { code: "S", name: "Staging Area" },
  { code: "C", name: "Cold Zone" },
  { code: "D", name: "Dock Area" },
];

const strategies: { value: PutawayRule["strategy"]; label: string }[] = [
  { value: "fixed", label: "Fixed" },
  { value: "zone", label: "Zone" },
  { value: "closest_empty", label: "Closest Empty" },
  { value: "consolidate", label: "Consolidate" },
];

const initialRules: PutawayRule[] = [
  {
    id: "pr-1",
    productId: "1",
    productSku: "WIDGET-001",
    productName: "Standard Widget",
    zoneCode: "A",
    strategy: "fixed",
    priority: 1,
    isActive: true,
  },
  {
    id: "pr-2",
    productId: "4",
    productSku: "BOLT-M8X40",
    productName: "M8x40 Hex Bolt",
    zoneCode: "B",
    strategy: "zone",
    priority: 2,
    isActive: true,
  },
  {
    id: "pr-3",
    productId: null,
    productSku: null,
    productName: null,
    zoneCode: null,
    strategy: "closest_empty",
    priority: 10,
    isActive: true,
  },
  {
    id: "pr-4",
    productId: "2",
    productSku: "GADGET-001",
    productName: "Premium Gadget",
    zoneCode: "A",
    strategy: "consolidate",
    priority: 1,
    isActive: false,
  },
];

const strategyColors: Record<PutawayRule["strategy"], "default" | "secondary" | "outline"> = {
  fixed: "default",
  zone: "secondary",
  closest_empty: "outline",
  consolidate: "secondary",
};

export default function PutawayRulesPage() {
  const [rules, setRules] = useState<PutawayRule[]>(initialRules);
  const [addOpen, setAddOpen] = useState(false);

  // Form state
  const [formProductId, setFormProductId] = useState("");
  const [formZoneCode, setFormZoneCode] = useState("");
  const [formStrategy, setFormStrategy] = useState<PutawayRule["strategy"]>("closest_empty");
  const [formPriority, setFormPriority] = useState("5");

  function resetForm() {
    setFormProductId("");
    setFormZoneCode("");
    setFormStrategy("closest_empty");
    setFormPriority("5");
  }

  function addRule() {
    const product = mockProducts.find((p) => p.id === formProductId);
    const newRule: PutawayRule = {
      id: `pr-${Date.now()}`,
      productId: formProductId || null,
      productSku: product?.sku ?? null,
      productName: product?.name ?? null,
      zoneCode: formZoneCode || null,
      strategy: formStrategy,
      priority: parseInt(formPriority, 10) || 5,
      isActive: true,
    };
    setRules((prev) => [...prev, newRule]);
    setAddOpen(false);
    resetForm();
    toast.success("Putaway rule added");
  }

  function deleteRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    toast.success("Putaway rule deleted");
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
                  {mockProducts.map((p) => (
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
                  {mockZones.map((z) => (
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
                  onChange={(e) => setFormStrategy(e.target.value as PutawayRule["strategy"])}
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
              <Button onClick={addRule}>Add Rule</Button>
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
                    <Badge variant={strategyColors[rule.strategy]}>
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
                      onClick={() => deleteRule(rule.id)}
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
