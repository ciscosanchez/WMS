import { getInventoryTransactionsPaginated } from "@/modules/inventory/actions";
import { PageHeader } from "@/components/shared/page-header";
import { MovementsTable } from "@/components/inventory/movements-table";

interface Props {
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function MovementsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const search = params.search || "";

  const result = await getInventoryTransactionsPaginated({ page, pageSize: 20, search });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Movements"
        description={`Transaction ledger for all inventory changes — ${result.total.toLocaleString()} records`}
      />

      <MovementsTable
        data={result.data}
        totalCount={result.total}
        currentPage={result.page}
        pageSize={result.pageSize}
        searchValue={search}
      />
    </div>
  );
}
