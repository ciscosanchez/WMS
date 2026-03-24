"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bot, Plus, Loader2, Wifi, WifiOff, AlertTriangle, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  getDevices,
  createDevice,
  updateDeviceStatus,
  deleteDevice,
  getDeviceTasks,
} from "@/modules/automation/actions";
import { useTranslations } from "next-intl";

// ─── Status helpers ─────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Wifi }> = {
  dev_online: { color: "bg-green-500", icon: Wifi },
  dev_offline: { color: "bg-gray-400", icon: WifiOff },
  dev_error: { color: "bg-red-500", icon: AlertTriangle },
  dev_maintenance: { color: "bg-yellow-500", icon: Wrench },
};

const DEVICE_TYPES = ["amr", "conveyor", "pick_to_light", "put_to_light", "sortation"] as const;

function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.dev_offline;
  return (
    <span className="relative flex h-3 w-3">
      {status === "dev_online" && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full ${cfg.color} opacity-75`}
        />
      )}
      <span className={`relative inline-flex h-3 w-3 rounded-full ${cfg.color}`} />
    </span>
  );
}

export default function AutomationPage() {
  const t = useTranslations("tenant.automation");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [devices, setDevices] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [creating, setCreating] = useState(false);

  // New device form
  const [form, setForm] = useState({
    warehouseId: "",
    code: "",
    name: "",
    type: "amr" as string,
    ipAddress: "",
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [devs, tks] = await Promise.all([getDevices(), getDeviceTasks()]);
      setDevices(devs);
      setTasks(tks);
    } catch {
      toast.error("Failed to load devices");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await createDevice(form);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Device registered");
        setShowNew(false);
        setForm({ warehouseId: "", code: "", name: "", type: "amr", ipAddress: "" });
        load();
      }
    } catch {
      toast.error("Failed to create device");
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    const res = await updateDeviceStatus(id, status);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Status updated");
      load();
    }
  }

  async function _handleDelete(id: string) {
    const res = await deleteDevice(id);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Device removed");
      load();
    }
  }

  function typeLabel(type: string) {
    const map: Record<string, string> = {
      amr: t("amr"),
      conveyor: t("conveyor"),
      pick_to_light: t("pickToLight"),
      put_to_light: t("putToLight"),
      sortation: t("sortation"),
    };
    return map[type] ?? type;
  }

  function statusLabel(status: string) {
    const map: Record<string, string> = {
      dev_online: t("online"),
      dev_offline: t("offline"),
      dev_error: t("error"),
      dev_maintenance: t("maintenance"),
    };
    return map[status] ?? status;
  }

  const onlineCount = devices.filter((d) => d.status === "dev_online").length;
  const errorCount = devices.filter((d) => d.status === "dev_error").length;
  const _pendingTasks = tasks.filter(
    (tk) => tk.status === "queued" || tk.status === "dispatched" || tk.status === "in_progress"
  ).length;

  return (
    <div className="space-y-6 p-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("newDevice")}
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("devices")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devices.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("online")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-bold">
              <StatusDot status="dev_online" />
              {onlineCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("error")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-bold text-red-600">
              {errorCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Devices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {t("devices")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : devices.length === 0 ? (
            <div className="py-12 text-center">
              <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">{t("noDevices")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("noDevicesDesc")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("deviceStatus")}</TableHead>
                  <TableHead>{t("deviceCode")}</TableHead>
                  <TableHead>{t("deviceName")}</TableHead>
                  <TableHead>{t("deviceType")}</TableHead>
                  <TableHead>{t("tasks")}</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {devices.map((dev: any) => (
                  <TableRow key={dev.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusDot status={dev.status} />
                        <span className="text-xs">{statusLabel(dev.status)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{dev.code}</TableCell>
                    <TableCell>{dev.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{typeLabel(dev.type)}</Badge>
                    </TableCell>
                    <TableCell>{dev._count?.deviceTasks ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={dev.status}
                        onValueChange={(v) => handleStatusChange(dev.id, v)}
                      >
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dev_online">{t("online")}</SelectItem>
                          <SelectItem value="dev_offline">{t("offline")}</SelectItem>
                          <SelectItem value="dev_error">{t("error")}</SelectItem>
                          <SelectItem value="dev_maintenance">{t("maintenance")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>{t("taskQueue")}</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No tasks queued</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {tasks.slice(0, 20).map((tk: any) => (
                  <TableRow key={tk.id}>
                    <TableCell className="font-mono text-sm">
                      {tk.device?.code ?? tk.deviceId}
                    </TableCell>
                    <TableCell>{tk.taskType}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          tk.status === "completed"
                            ? "default"
                            : tk.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {tk.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(tk.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Device Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newDevice")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("deviceCode")}</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="AMR-001"
              />
            </div>
            <div>
              <Label>{t("deviceName")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Locus Bot A1"
              />
            </div>
            <div>
              <Label>{t("deviceType")}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v ?? "amr" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_TYPES.map((dt) => (
                    <SelectItem key={dt} value={dt}>
                      {typeLabel(dt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>IP Address</Label>
              <Input
                value={form.ipAddress}
                onChange={(e) => setForm({ ...form, ipAddress: e.target.value })}
                placeholder="192.168.1.10"
              />
            </div>
            <div>
              <Label>Warehouse ID</Label>
              <Input
                value={form.warehouseId}
                onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                placeholder="Warehouse ID"
              />
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("newDevice")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
