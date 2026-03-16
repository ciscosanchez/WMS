import { PageSkeleton } from "@/components/shared/page-skeleton";
import { TableSkeleton } from "@/components/shared/table-skeleton";

export default function OrdersLoading() {
  return (
    <PageSkeleton>
      <TableSkeleton rows={6} columns={8} />
    </PageSkeleton>
  );
}
