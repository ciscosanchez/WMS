import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPermissionDiffSummary, type AccessRisk } from "@/lib/auth/rbac";
import type { TenantRole } from "../../../../../node_modules/.prisma/public-client";

type AccessReviewUser = {
  id: string;
  name: string;
  email: string;
  role: TenantRole;
  personas: string[];
  portalClientName: string | null;
  portalClientId: string | null;
  permissionOverrides: { grants: string[]; denies: string[] };
  risks: AccessRisk[];
};

function severityClasses(severity: AccessRisk["severity"]) {
  return severity === "high"
    ? "bg-red-100 text-red-700 border-red-200"
    : "bg-amber-100 text-amber-700 border-amber-200";
}

export function AccessReview({ users }: { users: AccessReviewUser[] }) {
  const customAccessUsers = users.filter(
    (user) =>
      user.permissionOverrides.grants.length > 0 || user.permissionOverrides.denies.length > 0
  );
  const portalUsers = users.filter((user) => user.portalClientId);
  const riskEntries = users.flatMap((user) => user.risks.map((risk) => ({ user, risk })));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Users Reviewed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Custom Access</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{customAccessUsers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Portal Bound</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{portalUsers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Risk Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{riskEntries.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Access Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {users.map((user) => {
            const diff = getPermissionDiffSummary(user.role, user.permissionOverrides);
            return (
              <div key={user.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline">{user.role.replace(/_/g, " ")}</Badge>
                      {user.personas.map((persona) => (
                        <Badge key={persona} variant="outline" className="bg-muted text-foreground">
                          {persona.replace(/_/g, " ")}
                        </Badge>
                      ))}
                      {user.portalClientName && (
                        <Badge
                          variant="outline"
                          className="bg-emerald-100 text-emerald-700 border-emerald-200"
                        >
                          Portal: {user.portalClientName}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground md:text-right">
                    <div>{diff.inheritedCount} inherited</div>
                    <div>{diff.added.length} added</div>
                    <div>{diff.removed.length} removed</div>
                    <div>{diff.effectiveCount} effective</div>
                  </div>
                </div>
                {user.risks.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {user.risks.map((risk) => (
                      <Badge
                        key={risk.code}
                        variant="outline"
                        className={severityClasses(risk.severity)}
                      >
                        {risk.message}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
