export type WarehouseAddressFields = {
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export const DEFAULT_WAREHOUSE_ADDRESS: WarehouseAddressFields = {
  address1: "",
  address2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "US",
};

export function composeWarehouseAddress(fields: WarehouseAddressFields) {
  const line1 = [fields.address1.trim(), fields.address2.trim()].filter(Boolean).join(" ");
  const line2 = [fields.city.trim(), fields.state.trim(), fields.postalCode.trim()]
    .filter(Boolean)
    .join(", ");
  return [line1, line2, fields.country.trim()].filter(Boolean).join(", ");
}

export function parseWarehouseAddress(address?: string | null): WarehouseAddressFields {
  if (!address) return DEFAULT_WAREHOUSE_ADDRESS;

  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const [line1 = "", city = "", statePostal = "", country = "US"] = parts;
  const statePostalParts = statePostal.split(/\s+/).filter(Boolean);
  const postalCode = statePostalParts.length > 1 ? (statePostalParts.at(-1) ?? "") : "";
  const state = postalCode ? statePostalParts.slice(0, -1).join(" ") : statePostal;

  return {
    address1: line1,
    address2: "",
    city,
    state,
    postalCode,
    country,
  };
}
