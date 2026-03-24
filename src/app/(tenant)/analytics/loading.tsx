import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <PageSkeleton hasAction={false}>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-[300px] rounded-lg" />
        <Skeleton className="h-[300px] rounded-lg" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <Skeleton className="h-[300px] rounded-lg" />
        <Skeleton className="h-[300px] rounded-lg" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <Skeleton className="h-[300px] rounded-lg" />
        <Skeleton className="h-[300px] rounded-lg" />
      </div>
    </PageSkeleton>
  );
}
