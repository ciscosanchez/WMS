import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function BillingLoading() {
  return (
    <PageSkeleton hasAction={false}>
      {/* KPI card skeletons */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      {/* Quick link skeletons */}
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
      {/* Table skeleton */}
      <Skeleton className="h-64 w-full rounded-lg" />
    </PageSkeleton>
  );
}
