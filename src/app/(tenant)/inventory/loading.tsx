import { PageSkeleton } from "@/components/shared/page-skeleton";
import { TableSkeleton } from "@/components/shared/table-skeleton";

export default function InventoryLoading() {
  return (
    <PageSkeleton hasAction={false}>
      <TableSkeleton rows={6} columns={7} />
    </PageSkeleton>
  );
}
