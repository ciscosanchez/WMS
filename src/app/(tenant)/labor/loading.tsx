import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function LaborLoading() {
  return (
    <PageSkeleton hasAction={false}>
      {/* KPI card skeletons */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
      {/* Chart skeletons */}
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
      {/* Table skeleton */}
      <Skeleton className="h-64 w-full rounded-lg" />
    </PageSkeleton>
  );
}
