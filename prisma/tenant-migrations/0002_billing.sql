-- Migration: 0002_billing
-- Adds the billing engine: rate cards, billing event ledger, invoices

-- ─── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE "BillingServiceType" AS ENUM (
  'receiving_pallet',
  'receiving_carton',
  'storage_pallet',
  'storage_sqft',
  'handling_order',
  'handling_line',
  'handling_unit',
  'shipping_markup',
  'value_add_hour'
);

CREATE TYPE "InvoiceStatus" AS ENUM (
  'draft',
  'sent',
  'paid',
  'overdue',
  'cancelled'
);

-- ─── Rate Cards ─────────────────────────────────────────────────────────────
-- One rate card per client (or clientId IS NULL = the global default).

CREATE TABLE "rate_cards" (
    "id"               TEXT          NOT NULL,
    "client_id"        TEXT,
    "monthly_minimum"  DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active"        BOOLEAN       NOT NULL DEFAULT true,
    "created_at"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_cards_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rate_cards_client_id_fkey"
        FOREIGN KEY ("client_id") REFERENCES "clients"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- Only one active rate card per client (NULLs are excluded from unique index)
CREATE UNIQUE INDEX "rate_cards_client_id_key"
    ON "rate_cards"("client_id")
    WHERE "client_id" IS NOT NULL;

-- ─── Rate Card Lines ─────────────────────────────────────────────────────────

CREATE TABLE "rate_card_lines" (
    "id"           TEXT               NOT NULL,
    "rate_card_id" TEXT               NOT NULL,
    "service_type" "BillingServiceType" NOT NULL,
    "unit_rate"    DECIMAL(10,4)      NOT NULL,
    "uom"          TEXT               NOT NULL DEFAULT '$',
    "created_at"   TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_card_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rate_card_lines_rate_card_id_fkey"
        FOREIGN KEY ("rate_card_id") REFERENCES "rate_cards"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "rate_card_lines_rate_card_id_service_type_key"
    ON "rate_card_lines"("rate_card_id", "service_type");

-- ─── Invoices ────────────────────────────────────────────────────────────────

CREATE TABLE "invoices" (
    "id"             TEXT          NOT NULL,
    "invoice_number" TEXT          NOT NULL,
    "client_id"      TEXT          NOT NULL,
    "status"         "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "period_start"   TIMESTAMP(3)  NOT NULL,
    "period_end"     TIMESTAMP(3)  NOT NULL,
    "subtotal"       DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total"          DECIMAL(10,2) NOT NULL DEFAULT 0,
    "due_date"       TIMESTAMP(3),
    "paid_at"        TIMESTAMP(3),
    "notes"          TEXT,
    "created_at"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey"          PRIMARY KEY ("id"),
    CONSTRAINT "invoices_number_key"    UNIQUE ("invoice_number"),
    CONSTRAINT "invoices_client_id_fkey"
        FOREIGN KEY ("client_id") REFERENCES "clients"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "invoices_client_id_idx" ON "invoices"("client_id");
CREATE INDEX "invoices_status_idx"    ON "invoices"("status");

-- ─── Invoice Lines ───────────────────────────────────────────────────────────

CREATE TABLE "invoice_lines" (
    "id"           TEXT               NOT NULL,
    "invoice_id"   TEXT               NOT NULL,
    "description"  TEXT               NOT NULL,
    "service_type" "BillingServiceType" NOT NULL,
    "qty"          DECIMAL(10,4)      NOT NULL,
    "unit_rate"    DECIMAL(10,4)      NOT NULL,
    "amount"       DECIMAL(10,2)      NOT NULL,
    "created_at"   TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invoice_lines_invoice_id_fkey"
        FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

-- ─── Billing Events (immutable ledger) ──────────────────────────────────────

CREATE TABLE "billing_events" (
    "id"             TEXT               NOT NULL,
    "client_id"      TEXT               NOT NULL,
    "service_type"   "BillingServiceType" NOT NULL,
    "qty"            DECIMAL(10,4)      NOT NULL,
    "unit_rate"      DECIMAL(10,4)      NOT NULL,
    "amount"         DECIMAL(10,2)      NOT NULL,
    "reference_type" TEXT,
    "reference_id"   TEXT,
    "invoice_id"     TEXT,
    "occurred_at"    TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"     TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "billing_events_client_id_fkey"
        FOREIGN KEY ("client_id") REFERENCES "clients"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "billing_events_invoice_id_fkey"
        FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "billing_events_client_id_idx"  ON "billing_events"("client_id");
CREATE INDEX "billing_events_occurred_at_idx" ON "billing_events"("occurred_at");
CREATE INDEX "billing_events_invoice_id_idx" ON "billing_events"("invoice_id");
