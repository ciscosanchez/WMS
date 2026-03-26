import { PageHeader } from "@/components/shared/page-header";
import { getOperationalAttributeDefinitions } from "@/modules/attributes/actions";
import { AttributesClient } from "./attributes-client";

export default async function OperationalAttributesPage() {
  const definitions = await getOperationalAttributeDefinitions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Attributes"
        description="Create tenant-specific fields for receiving, LPNs, and inventory identity."
      />
      <AttributesClient initialDefinitions={definitions} />
    </div>
  );
}
