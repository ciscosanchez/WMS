import type { PrismaClient, Prisma } from "../../../node_modules/.prisma/tenant-client";

interface AuditLogInput {
  userId: string;
  action: "create" | "update" | "delete";
  entityType: string;
  entityId: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  ipAddress?: string;
}

export async function logAudit(db: PrismaClient, input: AuditLogInput) {
  await db.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      changes: (input.changes as Prisma.InputJsonValue) ?? undefined,
      ipAddress: input.ipAddress,
    },
  });
}

export function diffChanges<T extends Record<string, unknown>>(
  oldData: T,
  newData: Partial<T>
): Record<string, { old: unknown; new: unknown }> | null {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  for (const key of Object.keys(newData)) {
    if (oldData[key] !== newData[key]) {
      changes[key] = { old: oldData[key], new: newData[key] };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}
