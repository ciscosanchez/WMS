-- Migration: 0023_order_line_operational_attributes
-- Extend operational attribute scope support into order lines

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'operational_attribute_scope'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'order_line'
      AND enumtypid = 'operational_attribute_scope'::regtype
  ) THEN
    ALTER TYPE operational_attribute_scope ADD VALUE 'order_line';
  END IF;
END $$;
