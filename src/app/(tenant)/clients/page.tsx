import { getClients } from "@/modules/clients/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";
import Link from "next/link";
import { ClientsTable } from "@/components/clients/clients-table";
import { EmptyState } from "@/components/shared/empty-state";

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" description="Manage cargo owners and consignees">
        <Button asChild>
          <Link href="/clients/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Link>
        </Button>
      </PageHeader>

      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Add your first client to start managing their cargo."
        >
          <Button asChild>
            <Link href="/clients/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <ClientsTable data={clients} />
      )}
    </div>
  );
}
