import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function TenantLoading() {
  return (
    <div className="space-y-6">
      {/* Page title skeleton */}
      <div className="space-y-1">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* KPI cards skeleton mimicking the dashboard layout */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-1 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity card skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between border-b pb-3 last:border-0">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
