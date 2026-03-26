import { getInventoryPaginated } from "@/modules/inventory/actions";
import { getOperationalAttributeDefinitions } from "@/modules/attributes/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Boxes } from "lucide-react";
import { InventoryTable } from "@/components/inventory/inventory-table";
import { EmptyState } from "@/components/shared/empty-state";
import { getTranslations } from "next-intl/server";
import { InventoryFilters } from "./inventory-filters";

interface Props {
  searchParams: Promise<{
    page?: string;
    search?: string;
    attributeDefinitionId?: string;
    attributeValue?: string;
  }>;
}

export default async function InventoryPage({ searchParams }: Props) {
  const t = await getTranslations("tenant.inventory");
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const search = params.search || "";
  const attributeDefinitionId = params.attributeDefinitionId || "";
  const attributeValue = params.attributeValue || "";

  const [result, attributeDefinitions] = await Promise.all([
    getInventoryPaginated({
      page,
      pageSize: 20,
      search,
      attributeDefinitionId: attributeDefinitionId || undefined,
      attributeValue: attributeValue || undefined,
    }),
    getOperationalAttributeDefinitions("inventory_record", "inventory:read"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("stockBrowser")}
        description={`${t("stockBrowserDesc")} — ${result.total.toLocaleString()} ${t("records")}`}
      />

      {attributeDefinitions.length > 0 && (
        <InventoryFilters
          definitions={attributeDefinitions.map((definition: { id: string; label: string }) => ({
            id: definition.id,
            label: definition.label,
          }))}
          currentDefinitionId={attributeDefinitionId}
          currentAttributeValue={attributeValue}
        />
      )}

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
