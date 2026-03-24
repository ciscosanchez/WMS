import Link from "next/link";
import { getInspectionQueue } from "@/modules/returns/actions";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ClipboardList } from "lucide-react";

export default async function InspectionQueuePage() {
  const queue = await getInspectionQueue();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Returns Inspection</h1>
        <p className="text-sm text-muted-foreground">
          Inspect returned items and assign dispositions
        </p>
      </div>

      {queue.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10" />
          <p className="text-sm">No returns pending inspection</p>
        </div>
      )}

      <div className="space-y-3">
        {queue.map(
          (rma: {
            id: string;
            rmaNumber: string;
            status: string;
            receivedAt: Date | string | null;
            client: { code: string; name: string };
            _count: { lines: number; inspections: number };
          }) => (
            <Link key={rma.id} href={`/inspect/${rma.id}`}>
              <Card className="transition-colors hover:border-primary">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-mono text-base font-semibold">{rma.rmaNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {rma.client.name} ({rma.client.code})
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={rma.status} />
                      <span className="text-xs text-muted-foreground">
                        {rma._count.lines} line{rma._count.lines !== 1 ? "s" : ""} &middot;{" "}
                        {rma._count.inspections} inspected
                      </span>
                    </div>
                    {rma.receivedAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Received{" "}
                        {new Date(rma.receivedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <div className="text-sm font-medium text-primary">Inspect &rarr;</div>
                </CardContent>
              </Card>
            </Link>
          )
        )}
      </div>
    </div>
  );
}
