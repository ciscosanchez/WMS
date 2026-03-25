import { getReplenishmentRules, checkReplenishmentNeeds } from "@/modules/replenishment/actions";

export default async function ReplenishmentPage() {
  const [rules, needs] = await Promise.all([getReplenishmentRules(), checkReplenishmentNeeds()]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Replenishment</h1>
        <p className="text-muted-foreground">Auto-reorder rules and pick-face replenishment</p>
      </div>

      {needs.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <h2 className="mb-2 font-semibold text-amber-800 dark:text-amber-300">
            Replenishment Needed ({needs.length})
          </h2>
          <div className="space-y-1">
            {needs.map((need: { ruleId: string; productSku: string; binBarcode: string; currentQty: number; reorderPoint: number; suggestedQty: number }) => (
              <div
                key={need.ruleId}
                className="flex items-center justify-between text-sm text-amber-700 dark:text-amber-400"
              >
                <span>
                  {need.productSku} in {need.binBarcode}: {need.currentQty} on hand (reorder at{" "}
                  {need.reorderPoint})
                </span>
                <span className="font-medium">Need +{need.suggestedQty}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Active Rules</h2>
        {rules.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <p className="text-muted-foreground">No replenishment rules configured.</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">SKU</th>
                  <th className="p-3 text-left font-medium">Product</th>
                  <th className="p-3 text-left font-medium">Bin</th>
                  <th className="p-3 text-right font-medium">Min</th>
                  <th className="p-3 text-right font-medium">Reorder</th>
                  <th className="p-3 text-right font-medium">Max</th>
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {rules.map((rule: any) => (
                  <tr key={rule.id} className="border-b">
                    <td className="p-3 font-mono text-xs">{rule.product?.sku ?? "—"}</td>
                    <td className="p-3">{rule.product?.name ?? "—"}</td>
                    <td className="p-3 font-mono text-xs">{rule.bin?.barcode ?? "—"}</td>
                    <td className="p-3 text-right">{rule.minQty}</td>
                    <td className="p-3 text-right font-medium">{rule.reorderPoint}</td>
                    <td className="p-3 text-right">{rule.maxQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
