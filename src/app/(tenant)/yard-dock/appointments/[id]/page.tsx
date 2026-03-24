import { getAppointment, updateAppointmentStatus } from "@/modules/yard-dock/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

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

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  return format(new Date(date), "MMM d, yyyy HH:mm");
}

// Status transition buttons configuration
const TRANSITION_BUTTONS: Record<
  string,
  { label: string; newStatus: string; variant?: "default" | "outline" | "destructive" }[]
> = {
  scheduled: [
    { label: "Confirm", newStatus: "confirmed" },
    { label: "Cancel", newStatus: "cancelled", variant: "destructive" },
  ],
  confirmed: [
    { label: "Check In", newStatus: "checked_in" },
    { label: "No Show", newStatus: "no_show", variant: "outline" },
    { label: "Cancel", newStatus: "cancelled", variant: "destructive" },
  ],
  checked_in: [
    { label: "Move to Dock", newStatus: "at_dock" },
    { label: "Cancel", newStatus: "cancelled", variant: "destructive" },
  ],
  at_dock: [], // handled dynamically based on direction
  loading: [{ label: "Complete", newStatus: "completed" }],
  unloading: [{ label: "Complete", newStatus: "completed" }],
};

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("tenant.yardDock");
  const appointment = await getAppointment(id);

  if (!appointment) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("appointmentNotFound")} description={t("appointmentNotFoundDesc")} />
        <Button asChild variant="outline">
          <Link href="/yard-dock/appointments">Back to Appointments</Link>
        </Button>
      </div>
    );
  }

  // Build action buttons for current status
  let actionButtons = TRANSITION_BUTTONS[appointment.status] ?? [];

  // Special handling for at_dock: show direction-specific button
  if (appointment.status === "at_dock") {
    actionButtons =
      appointment.direction === "inbound"
        ? [{ label: "Start Unloading", newStatus: "unloading" }]
        : [{ label: "Start Loading", newStatus: "loading" }];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("appointment")} ${appointment.appointmentNumber}`}
        description={`${appointment.direction === "inbound" ? "Inbound" : "Outbound"} appointment`}
      >
        <Button asChild variant="outline">
          <Link href="/yard-dock/appointments">Back to Appointments</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Appointment Details */}
        <Card>
          <CardHeader>
            <CardTitle>{t("appointmentDetails")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Appointment #</p>
                <p className="font-mono font-medium">{appointment.appointmentNumber}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Direction</p>
                <div className="mt-1">
                  <DirectionBadge direction={appointment.direction} />
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <div className="mt-1">
                  <StatusBadge status={appointment.status} />
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Client</p>
                <p className="font-medium">{appointment.client?.name ?? "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Carrier</p>
                <p className="font-medium">{appointment.carrier ?? "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Trailer #</p>
                <p className="font-mono font-medium">{appointment.trailerNumber ?? "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Dock Door</p>
                <p className="font-medium">
                  {appointment.dockDoor
                    ? `${appointment.dockDoor.code} - ${appointment.dockDoor.name}`
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Warehouse</p>
                <p className="font-medium">
                  {appointment.warehouse
                    ? `${appointment.warehouse.code} - ${appointment.warehouse.name}`
                    : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timing Details */}
        <Card>
          <CardHeader>
            <CardTitle>{t("timing")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Scheduled Start</p>
                <p className="font-medium">{formatDate(appointment.scheduledStart)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Scheduled End</p>
                <p className="font-medium">{formatDate(appointment.scheduledEnd)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Actual Arrival</p>
                <p className="font-medium">{formatDate(appointment.actualArrival)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Dock Start</p>
                <p className="font-medium">{formatDate(appointment.dockStart)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Dock End</p>
                <p className="font-medium">{formatDate(appointment.dockEnd)}</p>
              </div>
            </div>
            {appointment.notes && (
              <div className="text-sm">
                <p className="text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap">{appointment.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Linked Shipment */}
        {(appointment.inboundShipment || appointment.outboundShipment) && (
          <Card>
            <CardHeader>
              <CardTitle>Linked Shipment</CardTitle>
            </CardHeader>
            <CardContent>
              {appointment.inboundShipment && (
                <Link
                  href={`/receiving/${appointment.inboundShipment.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-mono font-medium">
                      {appointment.inboundShipment.shipmentNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">Inbound Shipment</p>
                  </div>
                  <Badge>{appointment.inboundShipment.status}</Badge>
                </Link>
              )}
              {appointment.outboundShipment && (
                <Link
                  href={`/shipping/${appointment.outboundShipment.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-mono font-medium">
                      {appointment.outboundShipment.shipmentNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">Outbound Shipment</p>
                  </div>
                  <Badge>{appointment.outboundShipment.status}</Badge>
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {/* Yard Visits */}
        {appointment.yardVisits && appointment.yardVisits.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Yard Visits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {appointment.yardVisits.map((visit: any) => (
                  <div
                    key={visit.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-mono text-sm font-medium">{visit.trailerNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        Spot: {visit.yardSpot?.code ?? "-"}{" "}
                        {visit.yardSpot?.name ? `(${visit.yardSpot.name})` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">
                        {visit.status?.replace(/_/g, " ") ?? "unknown"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {visit.arrivedAt ? format(new Date(visit.arrivedAt), "MMM d, HH:mm") : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Action Buttons */}
      {actionButtons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {actionButtons.map((action) => (
                <form
                  key={action.newStatus}
                  action={async () => {
                    "use server";
                    const result = await updateAppointmentStatus(id, action.newStatus);
                    if (result.error) {
                      // Error will be visible on next render via revalidation
                      return;
                    }
                    revalidatePath(`/yard-dock/appointments/${id}`);
                    redirect(`/yard-dock/appointments/${id}`);
                  }}
                >
                  <Button type="submit" variant={action.variant ?? "default"}>
                    {action.label}
                  </Button>
                </form>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
