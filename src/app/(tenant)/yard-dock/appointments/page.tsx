import { getAppointments } from "@/modules/yard-dock/actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Plus } from "lucide-react";
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

export default async function AppointmentsPage() {
  const t = await getTranslations("tenant.yardDock");
  const appointments = await getAppointments();

  return (
    <div className="space-y-6">
      <PageHeader title={t("appointments")} description={t("appointmentsDesc")}>
        <Button asChild>
          <Link href="/yard-dock/appointments/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("newAppointment")}
          </Link>
        </Button>
      </PageHeader>

      {appointments.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={t("noAppointments")}
          description={t("noAppointmentsDesc")}
        >
          <Button asChild>
            <Link href="/yard-dock/appointments/new">
              <Plus className="mr-2 h-4 w-4" />
              {t("newAppointment")}
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Appointment #</th>
                <th className="px-4 py-3 text-left font-medium">Direction</th>
                <th className="px-4 py-3 text-left font-medium">Client</th>
                <th className="px-4 py-3 text-left font-medium">Carrier</th>
                <th className="px-4 py-3 text-left font-medium">Trailer #</th>
                <th className="px-4 py-3 text-left font-medium">Dock Door</th>
                <th className="px-4 py-3 text-left font-medium">Time Slot</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {appointments.map(
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
                  <tr key={appt.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/yard-dock/appointments/${appt.id}`}
                        className="font-mono font-medium text-primary hover:underline"
                      >
                        {appt.appointmentNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <DirectionBadge direction={appt.direction} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{appt.client?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{appt.carrier ?? "-"}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {appt.trailerNumber ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {appt.dockDoor ? `${appt.dockDoor.code} - ${appt.dockDoor.name}` : "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(appt.scheduledStart), "MMM d, HH:mm")}
                      {" - "}
                      {format(new Date(appt.scheduledEnd), "HH:mm")}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={appt.status} />
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
