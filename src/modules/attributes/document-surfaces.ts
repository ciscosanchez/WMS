export type DocumentSurface = "label" | "manifest" | "packing_list";

export type DocumentAwareAttributeDefinition = {
  id: string;
  key: string;
  label: string;
  entityScope: string;
  dataType: string;
  behaviorFlags?: Record<string, unknown> | null;
  displayRules?: Record<string, unknown> | null;
};

function toBooleanFlag(value: unknown) {
  return value === true;
}

function getSurfaceFlagKey(surface: DocumentSurface) {
  if (surface === "packing_list") return "showOnPackingList";
  if (surface === "manifest") return "showOnManifest";
  return "showOnLabel";
}

export function isAttributeVisibleOnDocument(
  definition: DocumentAwareAttributeDefinition,
  surface: DocumentSurface
) {
  const behaviorFlags = definition.behaviorFlags ?? {};
  const displayRules = definition.displayRules ?? {};

  if (toBooleanFlag(behaviorFlags[getSurfaceFlagKey(surface)])) return true;

  const documentSurfaces = displayRules.documentSurfaces;
  if (Array.isArray(documentSurfaces)) {
    return documentSurfaces.map(String).includes(surface);
  }

  return false;
}

export function filterDocumentVisibleAttributes(
  definitions: DocumentAwareAttributeDefinition[],
  surface: DocumentSurface
) {
  return definitions.filter((definition) => isAttributeVisibleOnDocument(definition, surface));
}
