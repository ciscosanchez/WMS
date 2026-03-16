import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { ClientsTable } from "@/components/clients/clients-table";

const mockClients = [
  {
    id: "1",
    code: "ACME",
    name: "Acme Corporation",
    contactName: "John Smith",
    contactEmail: "john@acme.com",
    city: "Houston",
    state: "TX",
    isActive: true,
  },
  {
    id: "2",
    code: "GLOBEX",
    name: "Globex Industries",
    contactName: "Maria Garcia",
    contactEmail: "maria@globex.com",
    city: "Miami",
    state: "FL",
    isActive: true,
  },
  {
    id: "3",
    code: "INITECH",
    name: "Initech Logistics",
    contactName: "Bob Porter",
    contactEmail: "bob@initech.com",
    city: "Dallas",
    state: "TX",
    isActive: true,
  },
  {
    id: "4",
    code: "WAYNE",
    name: "Wayne Enterprises",
    contactName: "Lucius Fox",
    contactEmail: "lucius@wayne.com",
    city: "Chicago",
    state: "IL",
    isActive: false,
  },
  {
    id: "5",
    code: "STARK",
    name: "Stark Shipping Co",
    contactName: "Pepper Potts",
    contactEmail: "pepper@stark.com",
    city: "Los Angeles",
    state: "CA",
    isActive: true,
  },
];

export default function ClientsPage() {
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

      <ClientsTable data={mockClients} />
    </div>
  );
}
