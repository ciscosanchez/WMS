"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Bell, Save } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
  NOTIFICATION_CATEGORIES,
} from "@/modules/settings/notification-prefs-actions";
import type {
  NotificationCategory,
  NotificationPrefsMap,
  NotificationPref,
} from "@/modules/settings/notification-prefs-actions";

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  shipment_arrived: "Shipment Arrived",
  receiving_completed: "Receiving Completed",
  order_shipped: "Order Shipped",
  low_stock_alert: "Low Stock Alert",
  pick_task_assigned: "Pick Task Assigned",
};

const CATEGORY_DESCRIPTIONS: Record<NotificationCategory, string> = {
  shipment_arrived: "When an inbound shipment arrives at the dock",
  receiving_completed: "When a receiving job finishes processing",
  order_shipped: "When an outbound order is shipped",
  low_stock_alert: "When inventory drops below reorder point",
  pick_task_assigned: "When a new pick task is assigned to you",
};

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<NotificationPrefsMap | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getNotificationPrefs()
      .then((data) => {
        setPrefs(data);
        setIsLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load notification preferences");
        setIsLoading(false);
      });
  }, []);

  function togglePref(category: NotificationCategory, channel: "inApp" | "email") {
    if (!prefs) return;
    setPrefs({
      ...prefs,
      [category]: {
        ...prefs[category],
        [channel]: !prefs[category][channel],
      },
    });
  }

  function handleSave() {
    if (!prefs) return;

    const prefArray: NotificationPref[] = NOTIFICATION_CATEGORIES.map((cat) => ({
      category: cat,
      inApp: prefs[cat].inApp,
      email: prefs[cat].email,
    }));

    startSave(async () => {
      try {
        const result = await updateNotificationPrefs(prefArray);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Notification preferences saved");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save preferences");
      }
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Notification Preferences"
          description="Choose how you want to be notified"
        />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading preferences...
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Notification Preferences" description="Choose how you want to be notified">
        <Button onClick={handleSave} disabled={isSaving || !prefs}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Saving..." : "Save Preferences"}
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Channels
          </CardTitle>
        </CardHeader>
        <CardContent>
          {prefs && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Category</TableHead>
                    <TableHead className="text-center">In-App</TableHead>
                    <TableHead className="text-center">Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {NOTIFICATION_CATEGORIES.map((category) => (
                    <TableRow key={category}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{CATEGORY_LABELS[category]}</p>
                          <p className="text-xs text-muted-foreground">
                            {CATEGORY_DESCRIPTIONS[category]}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={prefs[category].inApp}
                          onCheckedChange={() => togglePref(category, "inApp")}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={prefs[category].email}
                          onCheckedChange={() => togglePref(category, "email")}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
