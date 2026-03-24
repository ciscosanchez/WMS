import { getCalendarAppointments } from "@/modules/yard-dock/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { CalendarGantt } from "./calendar-gantt";

interface CalendarPageProps {
  searchParams: Promise<{ date?: string; warehouseId?: string }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const t = await getTranslations("tenant.yardDock");
  const params = await searchParams;
  const date = params.date ?? new Date().toISOString().slice(0, 10);
  const warehouseId = params.warehouseId ?? "";

  const { doors, appointments } = warehouseId
    ? await getCalendarAppointments(warehouseId, date, date)
    : { doors: [], appointments: [] };

  return (
    <div className="space-y-6">
      <PageHeader title={t("calendar")} description={t("calendarSubtitle")} />

      <Card>
        <CardContent className="pt-6">
          <CalendarGantt
            initialDate={date}
            initialDoors={doors.map((d: { id: string; code: string; name: string }) => ({
              id: d.id,
              code: d.code,
              name: d.name,
            }))}
            initialAppointments={appointments.map(
              (a: {
                id: string;
                appointmentNumber: string;
                direction: string;
                status: string;
                scheduledStart: Date;
                scheduledEnd: Date;
                dockDoorId: string | null;
                client: { code: string; name: string } | null;
              }) => ({
                id: a.id,
                appointmentNumber: a.appointmentNumber,
                direction: a.direction,
                status: a.status,
                scheduledStart: new Date(a.scheduledStart).toISOString(),
                scheduledEnd: new Date(a.scheduledEnd).toISOString(),
                dockDoorId: a.dockDoorId,
                client: a.client,
              })
            )}
            labels={{
              dockDoor: t("dockDoor"),
              noAppointments: t("noAppointments"),
              inbound: t("inbound"),
              outbound: t("outbound"),
              prevDay: t("prevDay"),
              nextDay: t("nextDay"),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
