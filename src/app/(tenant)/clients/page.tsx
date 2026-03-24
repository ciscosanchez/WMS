import { getClients } from "@/modules/clients/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { ClientsTable } from "@/components/clients/clients-table";
import { EmptyState } from "@/components/shared/empty-state";
import { getTranslations } from "next-intl/server";

export default async function ClientsPage() {
  const t = await getTranslations("tenant.clients");
  const clients = await getClients();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Button asChild>
          <Link href="/clients/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("addClient")}
          </Link>
        </Button>
      </PageHeader>

      {clients.length === 0 ? (
        <EmptyState icon={Users} title={t("noClients")} description={t("noClientsDesc")}>
          <Button asChild>
            <Link href="/clients/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("addClient")}
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <ClientsTable data={clients} />
      )}
    </div>
  );
}
