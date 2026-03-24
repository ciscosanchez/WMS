import { getExpiringInventory } from "@/modules/inventory/actions";

export default async function ExpiringInventoryPage() {
  const expiring = await getExpiringInventory(30);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expiring Inventory</h1>
          <p className="text-muted-foreground">Items expiring within the next 30 days</p>
        </div>
      </div>

      {expiring.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">No items expiring in the next 30 days.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left font-medium">SKU</th>
                <th className="p-3 text-left font-medium">Product</th>
                <th className="p-3 text-left font-medium">Client</th>
                <th className="p-3 text-left font-medium">Lot</th>
                <th className="p-3 text-left font-medium">Location</th>
                <th className="p-3 text-right font-medium">Available</th>
                <th className="p-3 text-left font-medium">Expires</th>
                <th className="p-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {expiring.map((item: any) => {
                const now = new Date();
                const exp = new Date(item.expirationDate);
                const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const isExpired = daysLeft <= 0;
                const isCritical = daysLeft <= 7;

                return (
                  <tr key={item.id} className="border-b">
                    <td className="p-3 font-mono text-xs">{item.product?.sku ?? "—"}</td>
                    <td className="p-3">{item.product?.name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">
                      {item.product?.client?.name ?? "—"}
                    </td>
                    <td className="p-3 font-mono text-xs">{item.lotNumber ?? "—"}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {item.bin?.barcode ?? item.bin?.id?.slice(0, 8) ?? "—"}
                    </td>
                    <td className="p-3 text-right font-medium">{item.available}</td>
                    <td className="p-3">{exp.toLocaleDateString()}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          isExpired
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : isCritical
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}
                      >
                        {isExpired ? "Expired" : `${daysLeft}d left`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
