-- Add packaging fields to products for scan-out / release verification
ALTER TABLE products ADD COLUMN IF NOT EXISTS units_per_case INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS case_barcode TEXT;
