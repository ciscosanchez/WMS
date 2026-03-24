"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createAppointment } from "@/modules/yard-dock/actions";
import { getDockDoors } from "@/modules/yard-dock/actions";
import { getClients } from "@/modules/clients/actions";
import { getWarehouses } from "@/modules/warehouse/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export default function NewAppointmentPage() {
  const router = useRouter();
  const t = useTranslations("tenant.yardDock");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [warehouses, setWarehouses] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [dockDoors, setDockDoors] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clients, setClients] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [direction, setDirection] = useState<"inbound" | "outbound">("inbound");
  const [warehouseId, setWarehouseId] = useState("");
  const [dockDoorId, setDockDoorId] = useState("");
  const [clientId, setClientId] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trailerNumber, setTrailerNumber] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    getWarehouses().then(setWarehouses);
    getClients().then(setClients);
  }, []);

  function handleWarehouseChange(value: string) {
    setWarehouseId(value);
    setDockDoorId("");
    if (value) {
      getDockDoors(value).then((doors) => setDockDoors(doors));
    } else {
      setDockDoors([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createAppointment({
        direction,
        warehouseId,
        dockDoorId: dockDoorId || null,
        clientId: clientId || null,
        scheduledStart: new Date(scheduledStart),
        scheduledEnd: new Date(scheduledEnd),
        carrier: carrier || null,
        trailerNumber: trailerNumber || null,
        notes: notes || null,
      });

      if (result.error) {
        setError(result.error);
        toast.error(result.error);
        setIsSubmitting(false);
        return;
      }

      toast.success(`Appointment ${result.appointmentNumber} created`);
      router.push(`/yard-dock/appointments/${result.id}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to create appointment";
      setError(message);
      toast.error(message);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("newAppointment")} description={t("newAppointmentDesc")} />

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Direction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="direction"
                  value="inbound"
                  checked={direction === "inbound"}
                  onChange={() => setDirection("inbound")}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium">Inbound (Receiving)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="direction"
                  value="outbound"
                  checked={direction === "outbound"}
                  onChange={() => setDirection("outbound")}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium">Outbound (Shipping)</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("appointmentDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Warehouse *</Label>
              <select
                value={warehouseId}
                onChange={(e) => handleWarehouseChange(e.target.value)}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} - {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Dock Door</Label>
              <select
                value={dockDoorId}
                onChange={(e) => setDockDoorId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                disabled={!warehouseId}
              >
                <option value="">No specific door</option>
                {dockDoors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">No client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Carrier</Label>
              <Input
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="Carrier name"
              />
            </div>
            <div className="space-y-2">
              <Label>Scheduled Start *</Label>
              <Input
                type="datetime-local"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Scheduled End *</Label>
              <Input
                type="datetime-local"
                value={scheduledEnd}
                onChange={(e) => setScheduledEnd(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Trailer Number</Label>
              <Input
                value={trailerNumber}
                onChange={(e) => setTrailerNumber(e.target.value)}
                placeholder="e.g. TRL-12345"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Optional notes..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : t("newAppointment")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
