/**
 * NetSuite ERP Integration Client
 *
 * Handles two-way sync between WMS and NetSuite:
 * - Push: billable events (receiving, storage, handling, shipping) → NetSuite invoices
 * - Pull: customer records, rate cards, contracts → WMS clients
 * - Sync: product/SKU catalog both directions
 *
 * Uses NetSuite SuiteTalk REST API (OAuth 2.0)
 * Docs: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_1558708800.html
 */

export interface NetSuiteConfig {
  accountId: string;
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
  baseUrl: string;
}

export interface BillableEvent {
  clientId: string;
  eventType: "receiving" | "storage" | "handling" | "shipping" | "value_add";
  description: string;
  quantity: number;
  unitRate: number;
  total: number;
  referenceType: string;
  referenceId: string;
  occurredAt: Date;
}

export class NetSuiteClient {
  private config: NetSuiteConfig;

  constructor(config: NetSuiteConfig) {
    this.config = config;
  }

  /**
   * Push billable events to NetSuite for invoice generation
   */
  async pushBillableEvents(_events: BillableEvent[]): Promise<{ invoiceId: string }> {
    // TODO: Implement SuiteTalk REST API call
    // POST /services/rest/record/v1/invoice
    throw new Error("NetSuite integration not yet implemented");
  }

  /**
   * Sync customer from NetSuite → WMS client
   */
  async syncCustomer(_netsuiteCustomerId: string): Promise<{
    name: string;
    code: string;
    email: string;
    address: string;
  }> {
    // TODO: GET /services/rest/record/v1/customer/{id}
    throw new Error("NetSuite integration not yet implemented");
  }

  /**
   * Sync all active customers
   */
  async listCustomers(): Promise<Array<{ id: string; name: string; code: string }>> {
    // TODO: GET /services/rest/record/v1/customer with filters
    throw new Error("NetSuite integration not yet implemented");
  }

  /**
   * Push receiving confirmation (equivalent to item receipt in NetSuite)
   */
  async pushReceivingConfirmation(
    _shipmentId: string,
    _lines: Array<{
      itemId: string;
      quantity: number;
      locationId: string;
    }>
  ): Promise<void> {
    // TODO: POST /services/rest/record/v1/itemreceipt
    throw new Error("NetSuite integration not yet implemented");
  }

  /**
   * Push shipment fulfillment (equivalent to item fulfillment in NetSuite)
   */
  async pushShipmentFulfillment(
    _orderId: string,
    _trackingNumber: string,
    _carrier: string
  ): Promise<void> {
    // TODO: POST /services/rest/record/v1/itemfulfillment
    throw new Error("NetSuite integration not yet implemented");
  }
}
