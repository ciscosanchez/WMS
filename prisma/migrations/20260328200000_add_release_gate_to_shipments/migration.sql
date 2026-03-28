-- AddColumn: release gate tracking on outbound shipments
ALTER TABLE "shipments" ADD COLUMN "released_at" TIMESTAMP(3);
ALTER TABLE "shipments" ADD COLUMN "released_by" TEXT;
CREATE INDEX "shipments_released_at_idx" ON "shipments"("released_at");
