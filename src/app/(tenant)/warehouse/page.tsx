import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const mockWarehouses = [
  {
    id: "1",
    code: "WH1",
    name: "Main Warehouse",
    address: "123 Logistics Ave, Houston TX",
    zones: [
      { id: "z1", code: "A", name: "Zone A - General Storage", type: "storage", binCount: 80 },
      { id: "z2", code: "B", name: "Zone B - Bulk Storage", type: "storage", binCount: 32 },
      { id: "z3", code: "S", name: "Staging Area", type: "staging", binCount: 16 },
    ],
  },
  {
    id: "2",
    code: "WH2",
    name: "Cold Storage Annex",
    address: "125 Logistics Ave, Houston TX",
    zones: [
      { id: "z4", code: "C", name: "Cold Zone", type: "storage", binCount: 48 },
      { id: "z5", code: "D", name: "Dock Area", type: "dock", binCount: 8 },
    ],
  },
];

export default function WarehousePage() {
  const totalBins = mockWarehouses.reduce(
    (sum, wh) => sum + wh.zones.reduce((zs, z) => zs + z.binCount, 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse Locations"
        description={`${mockWarehouses.length} warehouses, ${totalBins} bins`}
      >
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/warehouse/bulk-generate">Bulk Generate</Link>
          </Button>
          <Button asChild>
            <Link href="/warehouse/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Warehouse
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mockWarehouses.map((wh) => {
          const binCount = wh.zones.reduce((s, z) => s + z.binCount, 0);
          return (
            <Link key={wh.id} href={`/warehouse/${wh.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{wh.name}</CardTitle>
                    <Badge variant="outline">{wh.code}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{wh.address}</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Zones</p>
                      <p className="text-lg font-semibold">{wh.zones.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Bins</p>
                      <p className="text-lg font-semibold">{binCount}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1">
                    {wh.zones.map((z) => (
                      <Badge key={z.id} variant="secondary">
                        {z.code} - {z.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
