import { getClients } from "@/modules/clients/actions";
import { getOperationalAttributeDefinitions } from "@/modules/attributes/actions";
import { NewShipmentClient } from "./new-shipment-client";

export default async function NewShipmentPage() {
  const [clients, attributeDefinitions] = await Promise.all([
    getClients(),
    getOperationalAttributeDefinitions("inbound_shipment"),
  ]);

  return (
    <NewShipmentClient
      clients={clients.map((client: { id: string; code: string; name: string }) => ({
        id: client.id,
        code: client.code,
        name: client.name,
      }))}
      attributeDefinitions={attributeDefinitions.map(
        (definition: {
          id: string;
          key: string;
          label: string;
          description: string | null;
          dataType:
            | "text"
            | "number"
            | "currency"
            | "date"
            | "boolean"
            | "single_select"
            | "multi_select"
            | "json";
          isRequired: boolean;
          options: Array<{ value: string; label: string; sortOrder: number; isActive: boolean }>;
        }) => ({
          id: definition.id,
          key: definition.key,
          label: definition.label,
          description: definition.description,
          dataType: definition.dataType,
          isRequired: definition.isRequired,
          options: definition.options,
        })
      )}
    />
  );
}
