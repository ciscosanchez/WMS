import type { PrismaClient } from "../../../node_modules/.prisma/tenant-client";

interface NotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: "info" | "warning" | "error" | "success";
  link?: string;
}

export async function createNotification(db: PrismaClient, input: NotificationInput) {
  return db.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type ?? "info",
      link: input.link,
    },
  });
}

export async function getUserNotifications(db: PrismaClient, userId: string, unreadOnly = false) {
  return db.notification.findMany({
    where: {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function markAsRead(db: PrismaClient, notificationId: string) {
  return db.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}
