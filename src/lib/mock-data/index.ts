export { mockClients, mockProducts, mockWarehouses } from "./master-data";
export { mockInventory, mockOrders, mockShipments, mockTransactions } from "./operations-data";
export { mockAdjustments, mockChannels, mockDiscrepancies } from "./supporting-data";

import { mockClients, mockProducts } from "./master-data";
import { mockShipments } from "./operations-data";

export function findClient(id: string) {
  return mockClients.find((client) => client.id === id) ?? null;
}

export function findProduct(id: string) {
  return mockProducts.find((product) => product.id === id) ?? null;
}

export function findShipment(id: string) {
  return mockShipments.find((shipment) => shipment.id === id) ?? null;
}
