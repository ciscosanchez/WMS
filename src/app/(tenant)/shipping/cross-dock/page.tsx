import {
  getCrossDockPlans,
  getCrossDockRules,
  deleteCrossDockRule,
  updateCrossDockStatus,
  completeCrossDock,
} from "@/modules/cross-dock/actions";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Repeat, Trash2, CheckCircle, XCircle, Play, ThumbsUp } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function CrossDockPage() {
  const t = await getTranslations("tenant.crossDock");
  const [plans, rules] = await Promise.all([
    getCrossDockPlans(),
    getCrossDockRules(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* ── Rules Section ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("rules")}</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title={t("noRules")}
              description={t("subtitle")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client ID</TableHead>
                  <TableHead>Product ID</TableHead>
                  <TableHead className="text-right">Priority</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map(
                  (rule: {
                    id: string;
                    clientId: string | null;
                    productId: string | null;
                    priority: number;
                  }) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-mono">
                        {rule.clientId ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono">
                        {rule.productId ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">{rule.priority}</TableCell>
                      <TableCell className="text-right">
                        <form
                          action={async () => {
                            "use server";
                            await deleteCrossDockRule(rule.id);
                          }}
                        >
                          <Button variant="ghost" size="sm" type="submit">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Plans Section ── */}
      <Card>
        <CardHeader>
          <CardTitle>{t("plans")}</CardTitle>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title={t("noPlans")}
              description={t("subtitle")}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("inboundShipment")}</TableHead>
                  <TableHead>{t("outboundOrder")}</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">{t("quantity")}</TableHead>
                  <TableHead>{t("sourceDock")}</TableHead>
                  <TableHead>{t("targetDock")}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map(
                  (plan: {
                    id: string;
                    inboundShipmentId: string;
                    outboundOrderId: string;
                    productId: string;
                    quantity: number;
                    sourceDockDoorId: string | null;
                    targetDockDoorId: string | null;
                    status: string;
                  }) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-mono text-sm">
                        {plan.inboundShipmentId.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {plan.outboundOrderId.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {plan.productId.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="text-right">{plan.quantity}</TableCell>
                      <TableCell>{plan.sourceDockDoorId ?? "—"}</TableCell>
                      <TableCell>{plan.targetDockDoorId ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={plan.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {plan.status === "cd_identified" && (
                            <form
                              action={async () => {
                                "use server";
                                await updateCrossDockStatus(plan.id, "cd_approved");
                              }}
                            >
                              <Button variant="ghost" size="sm" type="submit" title={t("approved")}>
                                <ThumbsUp className="h-4 w-4" />
                              </Button>
                            </form>
                          )}
                          {plan.status === "cd_approved" && (
                            <form
                              action={async () => {
                                "use server";
                                await updateCrossDockStatus(plan.id, "cd_in_progress");
                              }}
                            >
                              <Button variant="ghost" size="sm" type="submit" title={t("inProgress")}>
                                <Play className="h-4 w-4" />
                              </Button>
                            </form>
                          )}
                          {plan.status === "cd_in_progress" && (
                            <form
                              action={async () => {
                                "use server";
                                await completeCrossDock(plan.id);
                              }}
                            >
                              <Button variant="ghost" size="sm" type="submit" title={t("completed")}>
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                            </form>
                          )}
                          {["cd_identified", "cd_approved"].includes(plan.status) && (
                            <form
                              action={async () => {
                                "use server";
                                await updateCrossDockStatus(plan.id, "cd_cancelled");
                              }}
                            >
                              <Button variant="ghost" size="sm" type="submit" title={t("cancelled")}>
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </form>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
