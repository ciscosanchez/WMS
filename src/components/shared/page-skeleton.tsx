import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/shared/table-skeleton";

interface PageSkeletonProps {
  /** Show an action button skeleton in the header (e.g. "Add Client") */
  hasAction?: boolean;
  children?: React.ReactNode;
}

export function PageSkeleton({ hasAction = true, children }: PageSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Header area mimicking PageHeader */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        {hasAction && <Skeleton className="h-9 w-32" />}
      </div>

      {/* Content area */}
      {children ?? <TableSkeleton />}
    </div>
  );
}
