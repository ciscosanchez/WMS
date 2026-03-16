import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";

const mockChannels = [
  {
    id: "1",
    name: "Acme Shopify Store",
    type: "shopify",
    isActive: true,
    orderCount: 142,
    lastSync: "2 min ago",
  },
  {
    id: "2",
    name: "Acme Amazon Seller",
    type: "amazon",
    isActive: true,
    orderCount: 89,
    lastSync: "5 min ago",
  },
  {
    id: "3",
    name: "Globex Walmart",
    type: "walmart",
    isActive: true,
    orderCount: 34,
    lastSync: "15 min ago",
  },
  {
    id: "4",
    name: "Manual Orders",
    type: "manual",
    isActive: true,
    orderCount: 23,
    lastSync: null,
  },
  { id: "5", name: "Initech API", type: "api", isActive: false, orderCount: 0, lastSync: null },
];

const channelLogos: Record<string, string> = {
  shopify: "bg-green-100 text-green-700",
  amazon: "bg-orange-100 text-orange-700",
  walmart: "bg-blue-100 text-blue-700",
  manual: "bg-gray-100 text-gray-700",
  api: "bg-purple-100 text-purple-700",
};

export default function ChannelsPage() {
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
              {channel.lastSync && (
                <p className="mt-2 text-xs text-muted-foreground">Last synced {channel.lastSync}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
