import { getInventoryPaginated } from "@/modules/inventory/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Boxes } from "lucide-react";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { EmptyState } from "@/components/shared/empty-state";
import { getTranslations } from "next-intl/server";

interface Props {
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function InventoryPage({ searchParams }: Props) {
  const t = await getTranslations("tenant.inventory");
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const search = params.search || "";

  const result = await getInventoryPaginated({ page, pageSize: 20, search });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("stockBrowser")}
        description={`${t("stockBrowserDesc")} — ${result.total.toLocaleString()} ${t("records")}`}
      />

      {result.total === 0 && !search ? (
        <EmptyState icon={Boxes} title={t("noInventory")} description={t("noInventoryDesc")} />
      ) : (
        <InventoryTable
          data={result.data}
          totalCount={result.total}
          currentPage={result.page}
          pageSize={result.pageSize}
          searchValue={search}
        />
      )}
    </div>
  );
}
