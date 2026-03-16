import { getProducts } from "@/modules/products/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus, Package } from "lucide-react";
import Link from "next/link";
import { ProductsTable } from "@/components/products/products-table";
import { EmptyState } from "@/components/shared/empty-state";

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div className="space-y-6">
      <PageHeader title="Products" description="Manage SKUs and inventory items">
        <Button asChild>
          <Link href="/products/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Link>
        </Button>
      </PageHeader>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Add your first product to start tracking inventory."
        >
          <Button asChild>
            <Link href="/products/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <ProductsTable data={products} />
      )}
    </div>
  );
}
