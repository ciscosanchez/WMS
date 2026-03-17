"use client";

import { useState, useEffect, use } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, MapPin, Boxes, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getWarehouse, createZone } from "@/modules/warehouse/actions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function countBinsInAisle(aisle: any): number {
  return (
    aisle.racks?.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (rs: number, r: any) =>
        rs +
        (r.shelves?.reduce(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (ss: number, sh: any) => ss + (sh.bins?.length ?? 0),
          0
        ) ?? 0),
      0
    ) ?? 0
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function countBinsByStatus(aisle: any, status: string): number {
  let count = 0;
  for (const rack of aisle.racks ?? []) {
    for (const shelf of rack.shelves ?? []) {
      for (const bin of shelf.bins ?? []) {
        if (bin.status === status) count++;
      }
    }
  }
  return count;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function countRacksInAisle(aisle: any): number {
  return aisle.racks?.length ?? 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function countShelvesInAisle(aisle: any): number {
  return (
    aisle.racks?.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: number, r: any) => s + (r.shelves?.length ?? 0),
      0
    ) ?? 0
  );
}

export default function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [wh, setWh] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [addingZone, setAddingZone] = useState(false);
  const [zoneName, setZoneName] = useState("");
  const [zoneCode, setZoneCode] = useState("");
  const [zoneType, setZoneType] = useState("storage");
  const [creating, setCreating] = useState(false);

  async function loadWarehouse() {
    try {
      const data = await getWarehouse(id);
      setWh(data);
    } catch {
      setWh(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWarehouse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!wh) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        Warehouse not found.
      </div>
    );
  }

  // Compute totals from real nested data
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const totalBins = (wh.zones ?? []).reduce(
    (s: number, z: any) =>
      s + (z.aisles ?? []).reduce((as2: number, a: any) => as2 + countBinsInAisle(a), 0),
    0
  );
  const totalAvail = (wh.zones ?? []).reduce(
    (s: number, z: any) =>
      s + (z.aisles ?? []).reduce((as2: number, a: any) => as2 + countBinsByStatus(a, "available"), 0),
    0
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */

  async function handleCreateZone() {
    setCreating(true);
    try {
      await createZone({
        warehouseId: wh.id,
        code: zoneCode,
        name: zoneName,
        type: zoneType,
      });
      toast.success(`Zone ${zoneCode} created`);
      setAddingZone(false);
      setZoneCode("");
      setZoneName("");
      setZoneType("storage");
      // Refresh warehouse data
      await loadWarehouse();
    } catch (err) {
      toast.error(`Failed to create zone: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={wh.name} description={wh.address}>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-base">
            {wh.code}
          </Badge>
          <StatusBadge status={wh.isActive ? "active" : "suspended"} />
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Zones</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{(wh.zones ?? []).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Bins</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{totalBins}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Available</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-green-600">
              {totalAvail}{" "}
              {totalBins > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({Math.round((totalAvail / totalBins) * 100)}%)
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Zones */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Zones</h2>
        <Button onClick={() => setAddingZone(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Zone
        </Button>
      </div>

      <div className="space-y-4">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(wh.zones ?? []).map((zone: any) => {
          const zoneBins = (zone.aisles ?? []).reduce(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (s: number, a: any) => s + countBinsInAisle(a),
            0
          );
          const zoneAvail = (zone.aisles ?? []).reduce(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (s: number, a: any) => s + countBinsByStatus(a, "available"),
            0
          );
          return (
            <Card key={zone.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle>{zone.name}</CardTitle>
                    <Badge variant="outline">{zone.code}</Badge>
                    <Badge variant="secondary">{zone.type}</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {zoneAvail}/{zoneBins} bins available
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aisle</TableHead>
                      <TableHead>Racks</TableHead>
                      <TableHead>Shelves</TableHead>
                      <TableHead>Total Bins</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Full</TableHead>
                      <TableHead>Reserved</TableHead>
                      <TableHead>Utilization</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(zone.aisles ?? []).map((aisle: any) => {
                      const aisleBins = countBinsInAisle(aisle);
                      const aisleAvailable = countBinsByStatus(aisle, "available");
                      const aisleFull = countBinsByStatus(aisle, "full");
                      const aisleReserved = countBinsByStatus(aisle, "reserved");
                      const aisleRacks = countRacksInAisle(aisle);
                      const aisleShelves = countShelvesInAisle(aisle);
                      const utilization = aisleBins > 0 ? Math.round(((aisleBins - aisleAvailable) / aisleBins) * 100) : 0;
                      return (
                        <TableRow key={aisle.code ?? aisle.id}>
                          <TableCell className="font-medium">
                            {wh.code}-{zone.code}-{aisle.code}
                          </TableCell>
                          <TableCell>{aisleRacks}</TableCell>
                          <TableCell>{aisleShelves}</TableCell>
                          <TableCell>{aisleBins}</TableCell>
                          <TableCell className="text-green-600">{aisleAvailable}</TableCell>
                          <TableCell className="text-red-600">{aisleFull}</TableCell>
                          <TableCell className="text-yellow-600">{aisleReserved}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 rounded-full bg-muted">
                                <div
                                  className="h-2 rounded-full bg-primary"
                                  style={{
                                    width: `${utilization}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {utilization}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Zone Dialog */}
      {addingZone && (
        <Dialog open={addingZone} onOpenChange={setAddingZone}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Zone to {wh.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Zone Code</Label>
                  <Input
                    placeholder="C"
                    value={zoneCode}
                    onChange={(e) => setZoneCode(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Zone Name</Label>
                  <Input
                    placeholder="Zone C - Returns"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <select
                  value={zoneType}
                  onChange={(e) => setZoneType(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="storage">Storage</option>
                  <option value="staging">Staging</option>
                  <option value="dock">Dock</option>
                  <option value="quarantine">Quarantine</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddingZone(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateZone} disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Zone
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
