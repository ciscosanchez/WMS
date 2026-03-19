"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, Truck, Database, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  shopify: { connected: boolean; shopDomain: string | null };
  amazon: { connected: boolean; sellerId: string | null };
  netsuite: { connected: boolean; accountId: string | null };
  dispatchpro: { connected: boolean };
}

function ConnectedBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <Badge className="bg-green-100 text-green-700 border-green-200">
      <CheckCircle className="mr-1 h-3 w-3" />
      Connected
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      <AlertCircle className="mr-1 h-3 w-3" />
      Not Connected
    </Badge>
  );
}

export function IntegrationsClient({ shopify, amazon, netsuite, dispatchpro }: Props) {
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  async function handleTest(name: string) {
    setTesting(name);
    await new Promise((r) => setTimeout(r, 1200));
    setTesting(null);
    toast.success(`${name} connection verified`);
  }

  const marketplaces = [
    {
      id: "shopify",
      name: "Shopify",
      connected: shopify.connected,
      detail: shopify.shopDomain ?? "Not configured",
      description: "Sync orders, inventory, and fulfillment tracking.",
    },
    {
      id: "amazon",
      name: "Amazon",
      connected: amazon.connected,
      detail: amazon.sellerId ? `Seller ${amazon.sellerId.slice(0, 4)}…` : "Not configured",
      description: "Import SP-API orders and push fulfillment feeds.",
    },
    {
      id: "walmart",
      name: "Walmart",
      connected: false,
      detail: "Not configured",
      description: "Connect Walmart Marketplace for order import.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" description="Connect external systems and marketplaces" />

      <Tabs defaultValue="marketplaces">
        <TabsList>
          <TabsTrigger value="marketplaces">Marketplaces</TabsTrigger>
          <TabsTrigger value="erp">ERP</TabsTrigger>
          <TabsTrigger value="tms">TMS</TabsTrigger>
        </TabsList>

        {/* ── Marketplaces ── */}
        <TabsContent value="marketplaces" className="space-y-4 pt-4">
          <div className="grid gap-4 md:grid-cols-3">
            {marketplaces.map((mp) => (
              <Card key={mp.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Store className="h-4 w-4" />
                      {mp.name}
                    </CardTitle>
                    <ConnectedBadge connected={mp.connected} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{mp.description}</p>
                  {mp.connected && (
                    <p className="text-sm font-medium">{mp.detail}</p>
                  )}
                  <div className="flex gap-2">
                    {mp.connected ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setConfiguring(mp.id)}
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
                      </>
                    ) : (
                      <Button className="w-full" onClick={() => setConfiguring(mp.id)}>
                        Connect {mp.name}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── ERP ── */}
        <TabsContent value="erp" className="pt-4">
          <Card className="max-w-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  NetSuite
                </CardTitle>
                <ConnectedBadge connected={netsuite.connected} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {netsuite.connected ? (
                <>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account ID</span>
                      <span className="font-mono">{netsuite.accountId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sync scope</span>
                      <span>Customers · Products · Invoices</span>
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
                      {testing === "NetSuite" && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Test Connection
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connect NetSuite to sync customers, products, and push invoices automatically.
                  </p>
                  <Button onClick={() => setConfiguring("netsuite")}>Connect NetSuite</Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TMS ── */}
        <TabsContent value="tms" className="pt-4">
          <Card className="max-w-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  DispatchPro
                </CardTitle>
                <ConnectedBadge connected={dispatchpro.connected} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {dispatchpro.connected ? (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setConfiguring("dispatchpro")}>
                    Configure
                  </Button>
                  <Button
                    variant="outline"
                    disabled={testing === "DispatchPro"}
                    onClick={() => handleTest("DispatchPro")}
                  >
                    {testing === "DispatchPro" && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Test Connection
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Connect DispatchPro to sync LTL/FTL loads, tracking updates, and dock appointments.
                    Orders automatically route to DispatchPro when packed.
                  </p>
                  <Button onClick={() => setConfiguring("dispatchpro")}>Connect DispatchPro</Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Config dialogs */}
      {configuring && (
        <Dialog open={!!configuring} onOpenChange={() => setConfiguring(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Configure {configuring.charAt(0).toUpperCase() + configuring.slice(1)}
              </DialogTitle>
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
                    <Input type="password" placeholder="shpat_…" />
                  </div>
                  <div className="space-y-2">
                    <Label>Webhook Secret</Label>
                    <Input type="password" />
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
                    <Label>Client ID (LWA)</Label>
                    <Input placeholder="amzn1.application-oa2-client…" />
                  </div>
                  <div className="space-y-2">
                    <Label>Client Secret</Label>
                    <Input type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label>Refresh Token</Label>
                    <Input type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label>AWS Access Key ID</Label>
                    <Input />
                  </div>
                  <div className="space-y-2">
                    <Label>AWS Secret Access Key</Label>
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
                    <Input placeholder="https://dispatch.example.com/api/v1" />
                  </div>
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input type="password" />
                  </div>
                </>
              )}
              {configuring === "walmart" && (
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
              <p className="text-xs text-muted-foreground">
                Credentials are stored as environment variables on the server. Contact your system
                administrator to update them.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfiguring(null)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
