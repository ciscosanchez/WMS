/**
 * EDI Integrations — Barrel Export
 *
 * Provides parsing, generation, and types for X12 EDI transactions
 * commonly used in 3PL/warehouse operations:
 *   940 — Warehouse Shipping Order (inbound)
 *   945 — Warehouse Shipping Advice (outbound)
 *   856 — Advance Ship Notice (inbound)
 *   944 — Warehouse Stock Transfer Receipt (outbound)
 */

// Types
export type {
  EDISegment,
  EDIDocument,
  EDITransactionSet,
  EDISeparators,
  EDIParsingResult,
  EDI940,
  EDI940Header,
  EDI940LineItem,
  EDI945,
  EDI945Header,
  EDI945LineItem,
  EDI945Data,
  EDI856,
  EDI856Header,
  EDI856Item,
  EDI944,
  EDI944Header,
  EDI944LineItem,
  EDI944Data,
  EDIAddress,
  TradingPartner,
  TradingPartnerStatus,
  EDITransactionType,
} from "./types";

// Parser
export { parseEDI, parse940, parse856 } from "./parser";

// Generator
export { generate945, generate944 } from "./generator";
