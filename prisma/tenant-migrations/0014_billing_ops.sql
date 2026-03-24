-- Migration: 0014_billing_ops
-- Billing operations workbench: charge adjustments, approval workflow, disputes, PDF delivery

CREATE TYPE "InvoiceReviewStatus" AS ENUM ('review_pending', 'review_approved', 'review_rejected');
CREATE TYPE "DisputeStatus" AS ENUM ('dispute_open', 'dispute_under_review', 'dispute_resolved_credit', 'dispute_resolved_rejected', 'dispute_resolved_adjusted');

-- Extend billing_events with manual adjustment support
ALTER TABLE "billing_events" ADD COLUMN IF NOT EXISTS "is_manual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "billing_events" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "billing_events" ADD COLUMN IF NOT EXISTS "adjusted_by_id" TEXT;
ALTER TABLE "billing_events" ADD COLUMN IF NOT EXISTS "voided_at" TIMESTAMP(3);
ALTER TABLE "billing_events" ADD COLUMN IF NOT EXISTS "void_reason" TEXT;

-- Extend invoices with review + delivery tracking
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "review_status" "InvoiceReviewStatus" NOT NULL DEFAULT 'review_pending';
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "reviewed_by_id" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "review_notes" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "sent_method" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "pdf_url" TEXT;

-- Billing disputes
CREATE TABLE "billing_disputes" (
    "id"             TEXT            NOT NULL,
    "invoice_id"     TEXT            NOT NULL,
    "client_id"      TEXT            NOT NULL,
    "status"         "DisputeStatus" NOT NULL DEFAULT 'dispute_open',
    "reason"         TEXT            NOT NULL,
    "amount"         DECIMAL(10,2)   NOT NULL,
    "resolution"     TEXT,
    "resolved_by_id" TEXT,
    "resolved_at"    TIMESTAMP(3),
    "created_at"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_disputes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "billing_disputes_invoice_id_fkey"
        FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "billing_disputes_client_id_fkey"
        FOREIGN KEY ("client_id") REFERENCES "clients"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "billing_disputes_invoice_id_idx" ON "billing_disputes"("invoice_id");
CREATE INDEX "billing_disputes_client_id_idx"  ON "billing_disputes"("client_id");
CREATE INDEX "billing_disputes_status_idx"     ON "billing_disputes"("status");
