"use client";

import * as React from "react";
import { BellIcon, TruckIcon, AlertTriangleIcon, ClipboardCheckIcon, ZapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  timeAgo: string;
  read: boolean;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
}

const initialNotifications: Notification[] = [
  {
    id: "n1",
    title: "ASN-2026-0003 arrived at dock",
    timeAgo: "2 min ago",
    read: false,
    icon: TruckIcon,
    iconColor: "text-blue-600 bg-blue-100",
  },
  {
    id: "n2",
    title: "Low stock: WIDGET-001 below minimum",
    timeAgo: "15 min ago",
    read: false,
    icon: AlertTriangleIcon,
    iconColor: "text-amber-600 bg-amber-100",
  },
  {
    id: "n3",
    title: "Adjustment ADJ-2026-0002 pending approval",
    timeAgo: "1 hr ago",
    read: false,
    icon: ClipboardCheckIcon,
    iconColor: "text-purple-600 bg-purple-100",
  },
  {
    id: "n4",
    title: "Order ORD-2026-0004 rush — ship by today",
    timeAgo: "2 hr ago",
    read: true,
    icon: ZapIcon,
    iconColor: "text-red-600 bg-red-100",
  },
];

export function NotificationBell() {
  const [notifications, setNotifications] = React.useState(initialNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative h-8 w-8">
            <BellIcon className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
            <span className="sr-only">Notifications</span>
          </Button>
        }
      />
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
        <PopoverHeader className="border-b px-3 py-2">
          <PopoverTitle className="text-sm font-semibold">Notifications</PopoverTitle>
        </PopoverHeader>
        <div className="flex max-h-80 flex-col overflow-y-auto">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={cn(
                "flex items-start gap-3 border-b px-3 py-2.5 last:border-b-0",
                !notification.read && "bg-muted/50"
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  notification.iconColor
                )}
              >
                <notification.icon className="size-3.5" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p
                  className={cn(
                    "text-sm leading-snug",
                    !notification.read ? "font-medium" : "text-muted-foreground"
                  )}
                >
                  {notification.title}
                </p>
                <span className="text-xs text-muted-foreground">{notification.timeAgo}</span>
              </div>
              {!notification.read && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
              )}
            </div>
          ))}
        </div>
        <div className="border-t px-3 py-2">
          <button
            onClick={markAllRead}
            className="w-full text-center text-xs font-medium text-primary hover:underline"
          >
            Mark all as read
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
