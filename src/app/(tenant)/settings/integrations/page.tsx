"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, Truck, Database, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

const mockMarketplaces = [
  {
    id: "1",
    name: "Shopify",
    type: "shopify",
    connected: true,
    storeName: "Acme Store",
    ordersImported: 142,
    lastSync: "2 min ago",
  },
  {
    id: "2",
    name: "Amazon",
    type: "amazon",
    connected: true,
    storeName: "Acme Seller Central",
    ordersImported: 89,
    lastSync: "5 min ago",
  },
  {
    id: "3",
    name: "Walmart",
    type: "walmart",
    connected: false,
    storeName: null,
    ordersImported: 0,
    lastSync: null,
  },
];

const mockErp = {
  name: "NetSuite",
  connected: true,
  accountId: "****5678",
  lastSync: "10 min ago",
  syncedEntities: ["Customers", "Products", "Invoices"],
};

const mockTms = {
  name: "DispatchPro",
  connected: false,
  endpoint: null,
  lastSync: null,
};

export default function IntegrationsPage() {
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  async function handleTest(name: string) {
    setTesting(name);
    await new Promise((r) => setTimeout(r, 1500));
    setTesting(null);
    toast.success(`${name} connection successful`);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" description="Connect external systems and marketplaces" />

      <Tabs defaultValue="marketplaces">
        <TabsList>
          <TabsTrigger value="marketplaces">Marketplaces</TabsTrigger>
          <TabsTrigger value="erp">ERP</TabsTrigger>
          <TabsTrigger value="tms">TMS</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplaces" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            {mockMarketplaces.map((mp) => (
              <Card key={mp.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Store className="h-4 w-4" />
                      {mp.name}
                    </CardTitle>
                    {mp.connected ? (
                      <Badge className="bg-green-100 text-green-700">Connected</Badge>
                    ) : (
                      <Badge variant="outline">Not Connected</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mp.connected ? (
                    <>
                      <p className="text-sm">{mp.storeName}</p>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{mp.ordersImported} orders imported</span>
                        <span>Synced {mp.lastSync}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setConfiguring(mp.type)}
                        >
                          Configure
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          disabled={testing === mp.name}
                          onClick={() => handleTest(mp.name)}
                        >
                          {testing === mp.name ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle className="mr-1 h-3 w-3" />
                          )}
                          Test
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => setConfiguring(mp.type)}
                    >
                      Connect {mp.name}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="erp" className="pt-4">
          <Card className="max-w-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  {mockErp.name}
                </CardTitle>
                <Badge className="bg-green-100 text-green-700">Connected</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account ID</span>
                  <span className="font-mono">{mockErp.accountId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Sync</span>
                  <span>{mockErp.lastSync}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Synced Entities</span>
                  <div className="flex gap-1">
                    {mockErp.syncedEntities.map((e) => (
                      <Badge key={e} variant="secondary" className="text-xs">
                        {e}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setConfiguring("netsuite")}>
                  Configure
                </Button>
                <Button
                  variant="outline"
                  disabled={testing === "NetSuite"}
                  onClick={() => handleTest("NetSuite")}
                >
                  {testing === "NetSuite" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Test Connection
                </Button>
                <Button variant="outline" onClick={() => toast.success("Sync started")}>
                  Sync Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tms" className="pt-4">
          <Card className="max-w-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  {mockTms.name}
                </CardTitle>
                <Badge variant="outline">Not Connected</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect DispatchPro to sync LTL/FTL loads, tracking updates, and dock appointments.
              </p>
              <Button onClick={() => setConfiguring("dispatchpro")}>
                Connect DispatchPro
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Config dialog */}
      {configuring && (
        <Dialog open={!!configuring} onOpenChange={() => setConfiguring(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure {configuring}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {configuring === "shopify" && (
                <>
                  <div className="space-y-2">
                    <Label>Shop Domain</Label>
                    <Input placeholder="your-store.myshopify.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Access Token</Label>
                    <Input type="password" placeholder="shpat_..." />
                  </div>
                  <div className="space-y-2">
                    <Label>API Version</Label>
                    <Input defaultValue="2024-10" />
                  </div>
                </>
              )}
              {configuring === "amazon" && (
                <>
                  <div className="space-y-2">
                    <Label>Seller ID</Label>
                    <Input placeholder="A1B2C3D4E5" />
                  </div>
                  <div className="space-y-2">
                    <Label>Client ID</Label>
                    <Input placeholder="amzn1.application-oa2-client..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Secret</Label>
                    <Input type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label>Refresh Token</Label>
                    <Input type="password" />
                  </div>
                </>
              )}
              {configuring === "netsuite" && (
                <>
                  <div className="space-y-2">
                    <Label>Account ID</Label>
                    <Input placeholder="1234567" />
                  </div>
                  <div className="space-y-2">
                    <Label>Consumer Key</Label>
                    <Input type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label>Consumer Secret</Label>
                    <Input type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label>Token ID</Label>
                    <Input type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label>Token Secret</Label>
                    <Input type="password" />
                  </div>
                </>
              )}
              {configuring === "dispatchpro" && (
                <>
                  <div className="space-y-2">
                    <Label>API Endpoint</Label>
                    <Input placeholder="https://api.dispatchpro.com/v1" />
                  </div>
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input type="password" />
                  </div>
                </>
              )}
              {(configuring === "walmart") && (
                <>
                  <div className="space-y-2">
                    <Label>Client ID</Label>
                    <Input />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Secret</Label>
                    <Input type="password" />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfiguring(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    toast.success("Configuration saved");
                    setConfiguring(null);
                  }}
                >
                  Save & Connect
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
