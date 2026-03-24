import { getTranslations } from "next-intl/server";
import {
  getUnbilledEvents,
  addManualCharge,
  voidBillingEvent,
} from "@/modules/billing/charge-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Receipt } from "lucide-react";

export default async function ChargesPage() {
  const t = await getTranslations("tenant.billing");
  const events = await getUnbilledEvents().catch(() => []);

  async function handleAddCharge(formData: FormData) {
    "use server";
    const data = {
      clientId: formData.get("clientId") as string,
      serviceType: formData.get("serviceType") as string,
      qty: Number(formData.get("qty")),
      unitRate: Number(formData.get("unitRate")),
      description: formData.get("description") as string,
    };
    await addManualCharge(data);
  }

  async function handleVoid(formData: FormData) {
    "use server";
    const eventId = formData.get("eventId") as string;
    const reason = formData.get("reason") as string;
    await voidBillingEvent(eventId, reason);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("charges")} description={t("chargesSubtitle")} />

      {/* Add Manual Charge Form */}
      <Card>
        <CardHeader>
          <CardTitle>{t("addCharge")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleAddCharge} className="grid gap-4 md:grid-cols-6">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("client")}</label>
              <input
                name="clientId"
                required
                className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
                placeholder="Client ID"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("serviceType")}</label>
              <input
                name="serviceType"
                required
                className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("quantity")}</label>
              <input
                name="qty"
                type="number"
                min="1"
                required
                className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("unitRate")}</label>
              <input
                name="unitRate"
                type="number"
                step="0.01"
                min="0"
                required
                className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("description")}</label>
              <input
                name="description"
                required
                className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t("addCharge")}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Charges Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("chargesList")}</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <EmptyState icon={Receipt} title={t("noCharges")} description={t("noChargesDesc")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">{t("client")}</th>
                    <th className="pb-2 font-medium">{t("serviceType")}</th>
                    <th className="pb-2 font-medium">{t("quantity")}</th>
                    <th className="pb-2 font-medium">{t("unitRate")}</th>
                    <th className="pb-2 font-medium">{t("amount")}</th>
                    <th className="pb-2 font-medium">{t("status")}</th>
                    <th className="pb-2 font-medium">{t("date")}</th>
                    <th className="pb-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {events.map((event: any) => (
                    <tr key={event.id} className="border-b last:border-0">
                      <td className="py-2">{event.client?.name ?? event.clientId?.slice(0, 8)}</td>
                      <td className="py-2">{event.serviceType}</td>
                      <td className="py-2">{Number(event.qty)}</td>
                      <td className="py-2 font-mono">${Number(event.unitRate).toFixed(2)}</td>
                      <td className="py-2 font-mono">${Number(event.amount).toFixed(2)}</td>
                      <td className="py-2">
                        {event.isManual && (
                          <Badge variant="outline" className="mr-1">
                            {t("manualCharge")}
                          </Badge>
                        )}
                        {event.voidedAt && <Badge variant="destructive">{t("voided")}</Badge>}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(event.occurredAt).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        {!event.voidedAt && (
                          <form action={handleVoid} className="flex gap-2">
                            <input type="hidden" name="eventId" value={event.id} />
                            <input
                              name="reason"
                              required
                              placeholder={t("voidReason")}
                              className="flex h-8 w-32 rounded-md border bg-transparent px-2 text-xs"
                            />
                            <button
                              type="submit"
                              className="inline-flex h-8 items-center rounded-md border border-destructive px-2 text-xs text-destructive hover:bg-destructive/10"
                            >
                              {t("voidCharge")}
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
