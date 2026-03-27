import {
  filterDocumentVisibleAttributes,
  isAttributeVisibleOnDocument,
} from "@/modules/attributes/document-surfaces";

describe("document surface attribute visibility", () => {
  const baseDefinition = {
    id: "def-1",
    key: "room_reference",
    label: "Room Reference",
    entityScope: "order_line",
    dataType: "text",
  };

  it("includes attributes flagged directly for a label surface", () => {
    expect(
      isAttributeVisibleOnDocument(
        {
          ...baseDefinition,
          behaviorFlags: { showOnLabel: true },
        },
        "label"
      )
    ).toBe(true);
  });

  it("includes attributes listed in displayRules document surfaces", () => {
    expect(
      isAttributeVisibleOnDocument(
        {
          ...baseDefinition,
          displayRules: { documentSurfaces: ["manifest", "packing_list"] },
        },
        "manifest"
      )
    ).toBe(true);
  });

  it("filters out attributes not mapped to the requested surface", () => {
    const visible = filterDocumentVisibleAttributes(
      [
        { ...baseDefinition, behaviorFlags: { showOnLabel: true } },
        {
          ...baseDefinition,
          id: "def-2",
          key: "insurance_value",
          label: "Insurance Value",
          displayRules: { documentSurfaces: ["manifest"] },
        },
      ],
      "label"
    );

    expect(visible).toHaveLength(1);
    expect(visible[0]?.key).toBe("room_reference");
  });
});
