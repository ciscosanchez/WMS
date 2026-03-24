import { getProducts } from "@/modules/products/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus, Package } from "lucide-react";
import Link from "next/link";
import { ProductsTable } from "@/components/products/products-table";
import { EmptyState } from "@/components/shared/empty-state";
import { getTranslations } from "next-intl/server";

export default async function ProductsPage() {
  const t = await getTranslations("tenant.products");
  const products = await getProducts();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Button asChild>
          <Link href="/products/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("addProduct")}
          </Link>
        </Button>
      </PageHeader>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("noProducts")}
          description={t("noProductsDesc")}
        >
          <Button asChild>
            <Link href="/products/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("addProduct")}
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <ProductsTable data={products} />
      )}
    </div>
  );
}
