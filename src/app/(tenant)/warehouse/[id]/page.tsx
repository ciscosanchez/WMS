"use client";

import { useState } from "react";
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
import { Plus, MapPin, Boxes } from "lucide-react";
import { toast } from "sonner";

const mockWarehouse = {
  id: "1",
  code: "WH1",
  name: "Main Warehouse",
  address: "123 Logistics Ave, Houston TX 77001",
  isActive: true,
  zones: [
    {
      id: "z1",
      code: "A",
      name: "Zone A - General Storage",
      type: "storage",
      aisles: [
        {
          code: "01",
          racks: 4,
          shelves: 4,
          bins: 64,
          available: 42,
          full: 20,
          reserved: 2,
        },
        {
          code: "02",
          racks: 2,
          shelves: 4,
          bins: 16,
          available: 10,
          full: 5,
          reserved: 1,
        },
      ],
    },
    {
      id: "z2",
      code: "B",
      name: "Zone B - Bulk Storage",
      type: "storage",
      aisles: [
        {
          code: "01",
          racks: 4,
          shelves: 2,
          bins: 32,
          available: 18,
          full: 14,
          reserved: 0,
        },
      ],
    },
    {
      id: "z3",
      code: "S",
      name: "Staging Area",
      type: "staging",
      aisles: [
        {
          code: "01",
          racks: 2,
          shelves: 1,
          bins: 16,
          available: 12,
          full: 3,
          reserved: 1,
        },
      ],
    },
  ],
};

export default function WarehouseDetailPage() {
  const [addingZone, setAddingZone] = useState(false);
  const [zoneName, setZoneName] = useState("");
  const [zoneCode, setZoneCode] = useState("");
  const [zoneType, setZoneType] = useState("storage");
  const wh = mockWarehouse;

  const totalBins = wh.zones.reduce((s, z) => s + z.aisles.reduce((as, a) => as + a.bins, 0), 0);
  const totalAvail = wh.zones.reduce(
    (s, z) => s + z.aisles.reduce((as, a) => as + a.available, 0),
    0
  );

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
            <p className="mt-1 text-2xl font-bold">{wh.zones.length}</p>
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
              <span className="text-sm font-normal text-muted-foreground">
                ({Math.round((totalAvail / totalBins) * 100)}%)
              </span>
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
        {wh.zones.map((zone) => {
          const zoneBins = zone.aisles.reduce((s, a) => s + a.bins, 0);
          const zoneAvail = zone.aisles.reduce((s, a) => s + a.available, 0);
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
                    {zone.aisles.map((aisle) => (
                      <TableRow key={aisle.code}>
                        <TableCell className="font-medium">
                          {wh.code}-{zone.code}-{aisle.code}
                        </TableCell>
                        <TableCell>{aisle.racks}</TableCell>
                        <TableCell>{aisle.shelves}</TableCell>
                        <TableCell>{aisle.bins}</TableCell>
                        <TableCell className="text-green-600">{aisle.available}</TableCell>
                        <TableCell className="text-red-600">{aisle.full}</TableCell>
                        <TableCell className="text-yellow-600">{aisle.reserved}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-20 rounded-full bg-muted">
                              <div
                                className="h-2 rounded-full bg-primary"
                                style={{
                                  width: `${Math.round(((aisle.bins - aisle.available) / aisle.bins) * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(((aisle.bins - aisle.available) / aisle.bins) * 100)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
                <Button
                  onClick={() => {
                    toast.success(`Zone ${zoneCode} created`);
                    setAddingZone(false);
                  }}
                >
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
