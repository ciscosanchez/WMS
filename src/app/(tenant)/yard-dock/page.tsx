import { getAppointments } from "@/modules/yard-dock/actions";
import { getYardDockStats } from "@/modules/yard-dock/yard-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Truck, DoorOpen, MapPin, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { format } from "date-fns";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700",
    confirmed: "bg-indigo-100 text-indigo-700",
    checked_in: "bg-yellow-100 text-yellow-700",
    at_dock: "bg-orange-100 text-orange-700",
    loading: "bg-purple-100 text-purple-700",
    unloading: "bg-purple-100 text-purple-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-500",
    no_show: "bg-red-100 text-red-700",
  };
  return (
    <Badge className={colors[status] ?? "bg-gray-100 text-gray-700"}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  return direction === "inbound" ? (
    <Badge variant="outline" className="border-blue-300 text-blue-700">
      Inbound
    </Badge>
  ) : (
    <Badge variant="outline" className="border-orange-300 text-orange-700">
      Outbound
    </Badge>
  );
}

export default async function YardDockPage() {
  const t = await getTranslations("tenant.yardDock");
  const today = new Date().toISOString().slice(0, 10);

  const [stats, todayAppts] = await Promise.all([
    getYardDockStats(),
    getAppointments({ date: today }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")}>
        <Button asChild>
          <Link href="/yard-dock/appointments/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("newAppointment")}
          </Link>
        </Button>
      </PageHeader>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("todayAppointments")}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayAppointments}</div>
            <p className="text-xs text-muted-foreground">{t("todayAppointmentsDesc")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("activeTrailers")}</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeVisits}</div>
            <p className="text-xs text-muted-foreground">{t("activeTrailersDesc")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("doorsAvailable")}</CardTitle>
            <DoorOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.doorsAvailable}</div>
            <p className="text-xs text-muted-foreground">
              {t("doorsAvailableDesc", {
                available: stats.doorsAvailable,
                total: stats.doorsTotal,
              })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("spotsOccupied")}</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.spotsOccupied}</div>
            <p className="text-xs text-muted-foreground">
              {t("spotsOccupiedDesc", { occupied: stats.spotsOccupied, total: stats.spotsTotal })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Today's appointments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("todayAppointments")}</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/yard-dock/appointments">
              {t("appointments")} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {todayAppts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t("noAppointments")}</p>
          ) : (
            <div className="space-y-3">
              {todayAppts.map(
                (appt: {
                  id: string;
                  appointmentNumber: string;
                  direction: string;
                  status: string;
                  scheduledStart: Date;
                  scheduledEnd: Date;
                  carrier: string | null;
                  trailerNumber: string | null;
                  dockDoor: { code: string; name: string } | null;
                  client: { code: string; name: string } | null;
                }) => (
                  <Link
                    key={appt.id}
                    href={`/yard-dock/appointments/${appt.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-mono font-medium">{appt.appointmentNumber}</div>
                      <DirectionBadge direction={appt.direction} />
                      <StatusBadge status={appt.status} />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {appt.client && <span>{appt.client.name}</span>}
                      {appt.dockDoor && <span>Door {appt.dockDoor.code}</span>}
                      <span>
                        {format(new Date(appt.scheduledStart), "HH:mm")}–
                        {format(new Date(appt.scheduledEnd), "HH:mm")}
                      </span>
                    </div>
                  </Link>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:bg-muted/50 transition-colors">
          <Link href="/yard-dock/calendar" className="block p-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">{t("calendar")}</div>
                <div className="text-sm text-muted-foreground">{t("calendarSubtitle")}</div>
              </div>
            </div>
          </Link>
        </Card>
        <Card className="hover:bg-muted/50 transition-colors">
          <Link href="/yard-dock/yard-map" className="block p-6">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">{t("yardMap")}</div>
                <div className="text-sm text-muted-foreground">{t("yardMapSubtitle")}</div>
              </div>
            </div>
          </Link>
        </Card>
        <Card className="hover:bg-muted/50 transition-colors">
          <Link href="/yard-dock/check-in" className="block p-6">
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium">{t("checkIn")}</div>
                <div className="text-sm text-muted-foreground">{t("checkInSubtitle")}</div>
              </div>
            </div>
          </Link>
        </Card>
      </div>
    </div>
  );
}
