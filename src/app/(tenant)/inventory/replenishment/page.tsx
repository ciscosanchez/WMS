import { AlertTriangle, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  getReplenishmentRules,
  checkReplenishmentNeeds,
} from "@/modules/replenishment/actions";
import { ReplenishmentNeeds } from "@/components/inventory/replenishment-needs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ReplenishmentPage() {
  const [rules, needs] = await Promise.all([
    getReplenishmentRules(),
    checkReplenishmentNeeds(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Replenishment Dashboard"
        description="Monitor pick-face inventory and execute replenishment moves"
      />

      {/* Section: Replenishment Needs (Urgent) */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Replenishment Needs
          {needs.length > 0 && (
            <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {needs.length}
            </span>
          )}
        </h2>
        <ReplenishmentNeeds needs={needs} />
      </div>

      {/* Section: Rules Configuration */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Settings2 className="h-5 w-5" />
          Active Rules
        </h2>

        {rules.length === 0 ? (
          <EmptyState
            icon={Settings2}
            title="No Replenishment Rules"
            description="Configure replenishment rules to automate pick-face restocking."
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Bin</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  <TableHead className="text-right">Reorder Point</TableHead>
                  <TableHead className="text-right">Max</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {rules.map((rule: any) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-mono text-xs">
                      {rule.product?.sku ?? "-"}
                    </TableCell>
                    <TableCell>{rule.product?.name ?? "-"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {rule.bin?.barcode ?? rule.bin?.code ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {rule.minQty}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {rule.reorderPoint}
                    </TableCell>
                    <TableCell className="text-right">
                      {rule.maxQty}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
