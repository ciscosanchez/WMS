import { z } from "zod";

export const lpnContentLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  lotNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
});

export const createLpnSchema = z.object({
  binId: z.string().optional().nullable(),
  palletType: z.string().optional().nullable(),
  totalWeight: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  contents: z.array(lpnContentLineSchema).optional().default([]),
});

export const addContentSchema = z.object({
  lpnId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  lotNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
});

export const moveLpnSchema = z.object({
  lpnId: z.string().min(1),
  targetBinId: z.string().min(1),
});

export const receiveLpnSchema = z.object({
  binId: z.string().min(1),
  palletType: z.string().optional().nullable(),
  totalWeight: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  contents: z.array(lpnContentLineSchema).min(1, "At least one item required"),
});

export type CreateLpnFormData = z.input<typeof createLpnSchema>;
export type AddContentFormData = z.input<typeof addContentSchema>;
export type MoveLpnFormData = z.input<typeof moveLpnSchema>;
export type ReceiveLpnFormData = z.input<typeof receiveLpnSchema>;
