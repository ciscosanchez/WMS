"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { toast } from "sonner";

interface Channel {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  orderCount: number;
  lastSync: string | null;
  lastSyncMinutes: number | null;
}

const mockChannels: Channel[] = [
  {
    id: "1",
    name: "Acme Shopify Store",
    type: "shopify",
    isActive: true,
    orderCount: 142,
    lastSync: "2 min ago",
    lastSyncMinutes: 2,
  },
  {
    id: "2",
    name: "Acme Amazon Seller",
    type: "amazon",
    isActive: true,
    orderCount: 89,
    lastSync: "5 min ago",
    lastSyncMinutes: 5,
  },
  {
    id: "3",
    name: "Globex Walmart",
    type: "walmart",
    isActive: true,
    orderCount: 34,
    lastSync: "15 min ago",
    lastSyncMinutes: 15,
  },
  {
    id: "4",
    name: "Manual Orders",
    type: "manual",
    isActive: true,
    orderCount: 23,
    lastSync: null,
    lastSyncMinutes: null,
  },
  {
    id: "5",
    name: "Initech API",
    type: "api",
    isActive: false,
    orderCount: 0,
    lastSync: "2 hours ago",
    lastSyncMinutes: 120,
  },
];

const channelLogos: Record<string, string> = {
  shopify: "bg-green-100 text-green-700",
  amazon: "bg-orange-100 text-orange-700",
  walmart: "bg-blue-100 text-blue-700",
  manual: "bg-gray-100 text-gray-700",
  api: "bg-purple-100 text-purple-700",
};

function SyncStatusDot({ minutes }: { minutes: number | null }) {
  if (minutes === null) return null;

  let color: string;
  let title: string;

  if (minutes <= 15) {
    color = "bg-green-500";
    title = "Synced recently";
  } else if (minutes <= 60) {
    color = "bg-yellow-500";
    title = "Last sync > 15 min ago";
  } else {
    color = "bg-red-500";
    title = "Last sync > 1 hour ago";
  }

  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} title={title} />;
}

export default function ChannelsPage() {
  const [syncingId, setSyncingId] = useState<string | null>(null);

  function handleSync(channel: Channel) {
    if (syncingId) return;
    setSyncingId(channel.id);
    setTimeout(() => {
      setSyncingId(null);
      toast.success(`${channel.name} synced successfully`);
    }, 1200);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Sales Channels" description="Connect marketplaces and order sources">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Channel
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockChannels.map((channel) => (
          <Card key={channel.id} className={!channel.isActive ? "opacity-60" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{channel.name}</CardTitle>
                <StatusBadge status={channel.isActive ? "active" : "suspended"} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={channelLogos[channel.type]}>
                  {channel.type.charAt(0).toUpperCase() + channel.type.slice(1)}
                </Badge>
                <span className="text-sm text-muted-foreground">{channel.orderCount} orders</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SyncStatusDot minutes={channel.lastSyncMinutes} />
                  {channel.lastSync ? (
                    <p className="text-xs text-muted-foreground">Last synced {channel.lastSync}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No sync history</p>
                  )}
                </div>
                {channel.isActive && channel.type !== "manual" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={syncingId === channel.id}
                    onClick={() => handleSync(channel)}
                  >
                    {syncingId === channel.id ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3 w-3" />
                    )}
                    Sync Now
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
