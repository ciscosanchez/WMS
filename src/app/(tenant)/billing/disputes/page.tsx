import { getTranslations } from "next-intl/server";
import { getDisputes, resolveDispute } from "@/modules/billing/invoice-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { AlertTriangle } from "lucide-react";

const disputeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  dispute_open: "destructive",
  dispute_under_review: "secondary",
  dispute_resolved_credit: "default",
  dispute_resolved_no_change: "outline",
  dispute_dismissed: "outline",
};

export default async function DisputesPage() {
  const t = await getTranslations("tenant.billing");
  const disputes = await getDisputes().catch(() => []);

  async function handleResolve(formData: FormData) {
    "use server";
    const disputeId = formData.get("disputeId") as string;
    const status = formData.get("status") as string;
    const resolution = formData.get("resolution") as string;
    await resolveDispute(disputeId, status, resolution);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("disputes")} description={t("disputesSubtitle")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("disputesList")}</CardTitle>
        </CardHeader>
        <CardContent>
          {disputes.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title={t("noDisputes")}
              description={t("noDisputesDesc")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">{t("invoiceNumber")}</th>
                    <th className="pb-2 font-medium">{t("client")}</th>
                    <th className="pb-2 font-medium">{t("disputeReason")}</th>
                    <th className="pb-2 font-medium">{t("disputeAmount")}</th>
                    <th className="pb-2 font-medium">{t("status")}</th>
                    <th className="pb-2 font-medium">{t("date")}</th>
                    <th className="pb-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {disputes.map((dispute: any) => (
                    <tr key={dispute.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">
                        {dispute.invoice?.invoiceNumber ?? "-"}
                      </td>
                      <td className="py-2">{dispute.client?.name ?? "-"}</td>
                      <td className="py-2 max-w-48 truncate">{dispute.reason}</td>
                      <td className="py-2 font-mono">${Number(dispute.amount).toFixed(2)}</td>
                      <td className="py-2">
                        <Badge variant={disputeVariant[dispute.status] ?? "secondary"}>
                          {t(`dispute_${dispute.status}`)}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(dispute.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2">
                        {(dispute.status === "dispute_open" ||
                          dispute.status === "dispute_under_review") && (
                          <form action={handleResolve} className="flex items-end gap-2">
                            <input type="hidden" name="disputeId" value={dispute.id} />
                            <select
                              name="status"
                              required
                              className="flex h-8 rounded-md border bg-transparent px-2 text-xs"
                            >
                              <option value="dispute_resolved_credit">{t("resolvedCredit")}</option>
                              <option value="dispute_resolved_no_change">
                                {t("resolvedNoChange")}
                              </option>
                              <option value="dispute_dismissed">{t("dismissed")}</option>
                            </select>
                            <input
                              name="resolution"
                              required
                              placeholder={t("resolution")}
                              className="flex h-8 w-40 rounded-md border bg-transparent px-2 text-xs"
                            />
                            <button
                              type="submit"
                              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
                            >
                              {t("resolve")}
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
