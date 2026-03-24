import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getPortalProducts } from "@/modules/portal/actions";
import { NewOrderForm } from "./_form";
import { getTranslations } from "next-intl/server";

export default async function NewOrderPage() {
  const t = await getTranslations("portal.orders");
  const products = await getPortalProducts();

  return (
    <div className="space-y-6">
      <PageHeader title={t("newOrder")} description={t("newOrderDesc")}>
        <Button variant="outline" asChild>
          <Link href="/portal/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("back")}
          </Link>
        </Button>
      </PageHeader>

      <NewOrderForm products={products} />
    </div>
  );
}
