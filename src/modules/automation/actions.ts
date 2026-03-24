"use server";

import { revalidatePath } from "next/cache";
import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";
import { logAudit } from "@/lib/audit";
import {
  deviceSchemaStatic as deviceSchema,
  deviceUpdateSchemaStatic as deviceUpdateSchema,
  deviceStatusSchema,
  deviceTaskSchemaStatic as deviceTaskSchema,
} from "./schemas";

const PATH = "/warehouse/automation";

// ─── Mock data ──────────────────────────────────────────

const MOCK_DEVICES = [
  {
    id: "dev-1",
    warehouseId: "wh-1",
    code: "AMR-001",
    name: "Locus Bot A1",
    type: "amr",
    status: "dev_online",
    zoneId: null,
    ipAddress: "192.168.1.10",
    lastPingAt: new Date().toISOString(),
    config: {},
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deviceTasks: [],
    _count: { deviceTasks: 3 },
  },
  {
    id: "dev-2",
    warehouseId: "wh-1",
    code: "CONV-001",
    name: "Main Conveyor Belt",
    type: "conveyor",
    status: "dev_offline",
    zoneId: null,
    ipAddress: "192.168.1.20",
    lastPingAt: null,
    config: {},
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deviceTasks: [],
    _count: { deviceTasks: 0 },
  },
];

const MOCK_TASKS = [
  {
    id: "task-1",
    deviceId: "dev-1",
    taskType: "transport",
    status: "completed",
    payload: { from: "A-01-01", to: "B-02-03" },
    result: { success: true },
    dispatchedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

// ─── Device CRUD ────────────────────────────────────────

export async function getDevices(warehouseId?: string) {
  if (config.useMockData) {
    return warehouseId ? MOCK_DEVICES.filter((d) => d.warehouseId === warehouseId) : MOCK_DEVICES;
  }

  const { tenant } = await requireTenantContext("warehouse:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.automationDevice.findMany({
    where: {
      isActive: true,
      ...(warehouseId ? { warehouseId } : {}),
    },
    include: {
      _count: { select: { deviceTasks: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getDevice(id: string) {
  if (config.useMockData) {
    const device = MOCK_DEVICES.find((d) => d.id === id);
    if (!device) return null;
    return { ...device, deviceTasks: MOCK_TASKS };
  }

  const { tenant } = await requireTenantContext("warehouse:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.automationDevice.findUnique({
    where: { id },
    include: {
      deviceTasks: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

export async function createDevice(data: unknown): Promise<{ id?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-device" };

  try {
    const { user, tenant } = await requireTenantContext("warehouse:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = deviceSchema.parse(data);

    const device = await db.automationDevice.create({
      data: {
        warehouseId: parsed.warehouseId,
        code: parsed.code,
        name: parsed.name,
        type: parsed.type,
        zoneId: parsed.zoneId || null,
        ipAddress: parsed.ipAddress || null,
        config: parsed.config ?? {},
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "automation_device",
      entityId: device.id,
    });

    revalidatePath(PATH);
    return { id: device.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create device",
    };
  }
}

export async function updateDevice(id: string, data: unknown): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("warehouse:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = deviceUpdateSchema.parse(data);

    await db.automationDevice.update({
      where: { id },
      data: {
        ...(parsed.code !== undefined && { code: parsed.code }),
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.type !== undefined && { type: parsed.type }),
        ...(parsed.zoneId !== undefined && { zoneId: parsed.zoneId || null }),
        ...(parsed.ipAddress !== undefined && {
          ipAddress: parsed.ipAddress || null,
        }),
        ...(parsed.config !== undefined && { config: parsed.config }),
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "automation_device",
      entityId: id,
    });

    revalidatePath(PATH);
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update device",
    };
  }
}

export async function deleteDevice(id: string): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("warehouse:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    await db.automationDevice.update({
      where: { id },
      data: { isActive: false },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "delete",
      entityType: "automation_device",
      entityId: id,
    });

    revalidatePath(PATH);
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to delete device",
    };
  }
}

export async function updateDeviceStatus(id: string, status: string): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("warehouse:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = deviceStatusSchema.parse(status);

    await db.automationDevice.update({
      where: { id },
      data: {
        status: parsed,
        ...(parsed === "dev_online" ? { lastPingAt: new Date() } : {}),
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "automation_device",
      entityId: id,
      changes: { status: { old: null, new: parsed } },
    });

    revalidatePath(PATH);
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to update device status",
    };
  }
}

// ─── Device Tasks ───────────────────────────────────────

export async function getDeviceTasks(deviceId?: string, status?: string) {
  if (config.useMockData) {
    let tasks = MOCK_TASKS;
    if (deviceId) tasks = tasks.filter((t) => t.deviceId === deviceId);
    if (status) tasks = tasks.filter((t) => t.status === status);
    return tasks;
  }

  const { tenant } = await requireTenantContext("warehouse:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = tenant.db as any;

  return db.deviceTask.findMany({
    where: {
      ...(deviceId ? { deviceId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      device: { select: { id: true, code: true, name: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createDeviceTask(data: unknown): Promise<{ id?: string; error?: string }> {
  if (config.useMockData) return { id: "mock-task" };

  try {
    const { user, tenant } = await requireTenantContext("operator:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;
    const parsed = deviceTaskSchema.parse(data);

    const task = await db.deviceTask.create({
      data: {
        deviceId: parsed.deviceId,
        taskType: parsed.taskType,
        payload: parsed.payload ?? {},
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "create",
      entityType: "device_task",
      entityId: task.id,
    });

    revalidatePath(PATH);
    return { id: task.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create task",
    };
  }
}

export async function completeDeviceTask(
  id: string,
  result?: Record<string, unknown>
): Promise<{ error?: string }> {
  if (config.useMockData) return {};

  try {
    const { user, tenant } = await requireTenantContext("operator:write");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = tenant.db as any;

    await db.deviceTask.update({
      where: { id },
      data: {
        status: "completed",
        result: result ?? {},
        completedAt: new Date(),
      },
    });

    await logAudit(tenant.db, {
      userId: user.id,
      action: "update",
      entityType: "device_task",
      entityId: id,
    });

    revalidatePath(PATH);
    return {};
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to complete task",
    };
  }
}
