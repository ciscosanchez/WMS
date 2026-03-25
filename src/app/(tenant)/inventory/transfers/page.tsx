import Link from "next/link";
import { getTransferOrders } from "@/modules/transfers/actions";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_transit: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  received: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default async function TransferOrdersPage() {
  const transfers = await getTransferOrders();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transfer Orders</h1>
          <p className="text-muted-foreground">Move inventory between warehouses</p>
        </div>
        <Link
          href="/inventory/transfers/new"
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New Transfer
        </Link>
      </div>

      {transfers.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-muted-foreground">No transfer orders yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left font-medium">Transfer #</th>
                <th className="p-3 text-left font-medium">From</th>
                <th className="p-3 text-left font-medium">To</th>
                <th className="p-3 text-center font-medium">Lines</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {transfers.map((t: any) => (
                <tr key={t.id} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-mono text-xs font-medium">{t.transferNumber}</td>
                  <td className="p-3">{t.fromWarehouse?.name ?? "—"}</td>
                  <td className="p-3">{t.toWarehouse?.name ?? "—"}</td>
                  <td className="p-3 text-center">{t._count?.lines ?? 0}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[t.status] ?? ""}`}
                    >
                      {t.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
