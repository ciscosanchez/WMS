import { getRules } from "@/modules/workflow-rules/actions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Zap } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function WorkflowRulesPage() {
  const t = await getTranslations("tenant.rules");
  const rules = await getRules();

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {rules.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState icon={Zap} title={t("noRules")} description={t("noRulesDesc")} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map(
            (rule: {
              id: string;
              name: string;
              trigger: string;
              conditions: unknown[];
              actions: unknown[];
              priority: number;
              isActive: boolean;
            }) => (
              <Card key={rule.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{rule.name}</span>
                      <Badge variant="outline">{rule.trigger}</Badge>
                      <Badge variant="secondary">
                        {(rule.conditions as unknown[]).length} conditions
                      </Badge>
                      <Badge variant="secondary">
                        {(rule.actions as unknown[]).length} actions
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">Priority: {rule.priority}</p>
                  </div>
                  <Badge className={rule.isActive ? "bg-green-100 text-green-700" : "bg-gray-100"}>
                    {rule.isActive ? t("active") : t("inactive")}
                  </Badge>
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}
