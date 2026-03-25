import { z } from "zod";

export const transferOrderSchema = z.object({
  fromWarehouseId: z.string().min(1, "Source warehouse is required"),
  toWarehouseId: z.string().min(1, "Destination warehouse is required"),
  notes: z.string().optional(),
});

export const transferOrderLineSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  lotNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type TransferOrderInput = z.infer<typeof transferOrderSchema>;
export type TransferOrderLineInput = z.infer<typeof transferOrderLineSchema>;
