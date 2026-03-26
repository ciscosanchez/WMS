"use server";

import { config } from "@/lib/config";
import { requireTenantContext } from "@/lib/tenant/context";

async function getContext() {
  return requireTenantContext("shipping:read");
}

export async function getPickTasks() {
  if (config.useMockData) return [];

  const { tenant } = await getContext();

  const tasks = await tenant.db.pickTask.findMany({
    include: {
      order: { select: { orderNumber: true } },
      lines: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return tasks.map(
    (t: {
      id: string;
      taskNumber: string;
      method: string;
      status: string;
      assignedTo: string | null;
      orderId: string | null;
      order: { orderNumber: string } | null;
      lines: Array<unknown>;
      startedAt: Date | null;
      completedAt: Date | null;
    }) => ({
      id: t.id,
      taskNumber: t.taskNumber,
      method: t.method,
      status: t.status,
      assignedTo: t.assignedTo,
      orderId: t.orderId,
      orderNumber: t.order?.orderNumber ?? "-",
      items: t.lines.length,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
    })
  );
}

export async function getPickingKpis() {
  if (config.useMockData) return { pending: 0, inProgress: 0, completedToday: 0, shortPicked: 0 };

  const { tenant } = await getContext();
  const db = tenant.db;
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

  const [pending, inProgress, completedToday, shortPicked] = await Promise.all([
    db.pickTask.count({ where: { status: "pending" } }),
    db.pickTask.count({ where: { status: "in_progress" } }),
    db.pickTask.count({ where: { status: "completed", completedAt: { gte: todayStart } } }),
    db.pickTask.count({ where: { status: "short_picked" } }),
  ]);

  return { pending, inProgress, completedToday, shortPicked };
}
