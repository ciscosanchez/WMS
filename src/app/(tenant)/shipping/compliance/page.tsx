import {
  getComplianceChecks,
  getHazmatFlags,
  resolveComplianceCheck,
  removeHazmatFlag,
} from "@/modules/compliance/actions";
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
import { Shield, CheckCircle, AlertTriangle, XCircle, Trash2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function CompliancePage() {
  const t = await getTranslations("tenant.compliance");
  const [checks, hazmatFlags] = await Promise.all([getComplianceChecks(), getHazmatFlags()]);

  const pendingChecks = checks.filter((c: { status: string }) => c.status === "comp_pending");

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* ── Compliance Checks ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("complianceChecks")}
            {pendingChecks.length > 0 && (
              <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                {pendingChecks.length} {t("pending")}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {checks.length === 0 ? (
            <EmptyState icon={Shield} title={t("noChecks")} description={t("subtitle")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checks.map(
                  (check: {
                    id: string;
                    entityType: string;
                    entityId: string;
                    checkType: string;
                    status: string;
                    details: string | null;
                  }) => (
                    <TableRow key={check.id}>
                      <TableCell>
                        <span className="font-mono text-xs">
                          {check.entityType}:{check.entityId.slice(0, 8)}
                        </span>
                      </TableCell>
                      <TableCell className="capitalize">
                        {check.checkType.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={check.status} />
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {check.details ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {check.status === "comp_pending" && (
                          <div className="flex items-center justify-end gap-1">
                            <form
                              action={async () => {
                                "use server";
                                await resolveComplianceCheck(check.id, {
                                  status: "comp_cleared",
                                });
                              }}
                            >
                              <Button variant="ghost" size="sm" type="submit" title={t("cleared")}>
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                            </form>
                            <form
                              action={async () => {
                                "use server";
                                await resolveComplianceCheck(check.id, {
                                  status: "comp_flagged",
                                });
                              }}
                            >
                              <Button variant="ghost" size="sm" type="submit" title={t("flagged")}>
                                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                              </Button>
                            </form>
                            <form
                              action={async () => {
                                "use server";
                                await resolveComplianceCheck(check.id, {
                                  status: "comp_blocked",
                                });
                              }}
                            >
                              <Button variant="ghost" size="sm" type="submit" title={t("blocked")}>
                                <XCircle className="h-4 w-4 text-red-600" />
                              </Button>
                            </form>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Hazmat Products ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            {t("hazmatProducts")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hazmatFlags.length === 0 ? (
            <EmptyState icon={AlertTriangle} title={t("noChecks")} description={t("subtitle")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>{t("unNumber")}</TableHead>
                  <TableHead>{t("hazClass")}</TableHead>
                  <TableHead>{t("packingGroup")}</TableHead>
                  <TableHead>Restricted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hazmatFlags.map(
                  (flag: {
                    id: string;
                    productId: string;
                    unNumber: string | null;
                    hazClass: string | null;
                    packingGroup: string | null;
                    properName: string | null;
                    isRestricted: boolean;
                    product: { name: string; sku: string };
                  }) => (
                    <TableRow key={flag.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{flag.product.name}</p>
                          <p className="text-xs text-muted-foreground">{flag.product.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{flag.unNumber ?? "—"}</TableCell>
                      <TableCell>{flag.hazClass ?? "—"}</TableCell>
                      <TableCell>{flag.packingGroup ?? "—"}</TableCell>
                      <TableCell>
                        {flag.isRestricted ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                            Yes
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <form
                          action={async () => {
                            "use server";
                            await removeHazmatFlag(flag.productId);
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
    </div>
  );
}
