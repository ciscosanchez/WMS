import { PageSkeleton } from "@/components/shared/page-skeleton";
import { TableSkeleton } from "@/components/shared/table-skeleton";

export default function ReturnsLoading() {
  return (
    <PageSkeleton>
      <TableSkeleton rows={5} columns={7} />
    </PageSkeleton>
  );
}
