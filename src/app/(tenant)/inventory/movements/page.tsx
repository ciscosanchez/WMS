import { getInventoryTransactionsPaginated } from "@/modules/inventory/actions";
import { PageHeader } from "@/components/shared/page-header";
import { MovementsTable } from "@/components/inventory/movements-table";
import { getTranslations } from "next-intl/server";

interface Props {
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function MovementsPage({ searchParams }: Props) {
  const t = await getTranslations("tenant.inventory");
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const search = params.search || "";

  const result = await getInventoryTransactionsPaginated({ page, pageSize: 20, search });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("movements")}
        description={`${t("movementsDesc")} — ${result.total.toLocaleString()} ${t("records")}`}
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
