"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDistanceToNow } from "date-fns";

interface Channel {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  orderCount: number;
  updatedAt: Date;
}

const channelLogos: Record<string, string> = {
  shopify: "bg-green-100 text-green-700",
  amazon: "bg-orange-100 text-orange-700",
  walmart: "bg-blue-100 text-blue-700",
  manual: "bg-gray-100 text-gray-700",
  api: "bg-purple-100 text-purple-700",
};

interface Props {
  channels: Channel[];
}

export function ChannelsClient({ channels }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader title="Sales Channels" description="Connect marketplaces and order sources">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Channel
        </Button>
      </PageHeader>

      {channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <h3 className="mt-4 text-lg font-semibold">No sales channels configured</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a channel to start importing orders from marketplaces.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel) => (
            <Card key={channel.id} className={!channel.isActive ? "opacity-60" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{channel.name}</CardTitle>
                  <StatusBadge status={channel.isActive ? "active" : "suspended"} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={channelLogos[channel.type] ?? "bg-gray-100 text-gray-700"}>
                    {channel.type.charAt(0).toUpperCase() + channel.type.slice(1)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{channel.orderCount} orders</span>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">
                    Updated {formatDistanceToNow(new Date(channel.updatedAt), { addSuffix: true })}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
