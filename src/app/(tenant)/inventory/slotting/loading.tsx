import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function SlottingLoading() {
  return (
    <PageSkeleton hasAction={true}>
      {/* Summary card skeletons */}
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
      {/* Table skeleton */}
      <Skeleton className="h-64 w-full rounded-lg" />
    </PageSkeleton>
  );
}
