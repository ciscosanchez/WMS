import { attributeDefinitionSchema } from "@/modules/attributes/schemas";

describe("operational attribute definition schema", () => {
  it("accepts a valid scoped single-select definition", () => {
    const parsed = attributeDefinitionSchema.parse({
      key: "room_reference",
      label: "Room Reference",
      entityScope: "inbound_shipment_line",
      dataType: "single_select",
      isRequired: true,
      behaviorFlags: { searchable: true, allocatable: true },
      options: [
        { value: "living_room", label: "Living Room", sortOrder: 0 },
        { value: "primary_bedroom", label: "Primary Bedroom", sortOrder: 1 },
      ],
    });

    expect(parsed.key).toBe("room_reference");
    expect(parsed.options).toHaveLength(2);
    expect(parsed.behaviorFlags).toEqual({ searchable: true, allocatable: true });
  });

  it("accepts order-line scoped definitions for downstream allocation use", () => {
    const parsed = attributeDefinitionSchema.parse({
      key: "room_reference",
      label: "Room Reference",
      entityScope: "order_line",
      dataType: "text",
      behaviorFlags: { allocatable: true },
    });

    expect(parsed.entityScope).toBe("order_line");
    expect(parsed.behaviorFlags).toEqual({ allocatable: true });
  });

  it("rejects non-normalized keys", () => {
    expect(() =>
      attributeDefinitionSchema.parse({
        key: "Room Reference",
        label: "Room Reference",
        entityScope: "inbound_shipment_line",
        dataType: "text",
      })
    ).toThrow(/Key must start with a letter/);
  });
});
