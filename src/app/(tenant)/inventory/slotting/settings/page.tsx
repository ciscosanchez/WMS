import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSlottingConfig, updateSlottingConfig } from "@/modules/slotting/actions";
import { getTranslations } from "next-intl/server";

export default async function SlottingSettingsPage() {
  const t = await getTranslations("tenant.slotting");
  // Use the first active warehouse — slotting config is per-warehouse
  const { requireTenantContext } = await import("@/lib/tenant/context");
  const { tenant } = await requireTenantContext("inventory:read");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const warehouse = await (tenant.db as any).warehouse.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  const warehouseId = warehouse?.id ?? "";
  const config = warehouseId ? await getSlottingConfig(warehouseId) : null;

  return (
    <div className="space-y-6">
      <PageHeader title={t("settingsTitle")} description={t("settingsDesc")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("slottingParameters")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              "use server";
              await updateSlottingConfig(warehouseId, {
                abcAThreshold: Number(formData.get("abcAThreshold")),
                abcBThreshold: Number(formData.get("abcBThreshold")),
                lookbackDays: Number(formData.get("lookbackDays")),
                weightPenalty: Number(formData.get("weightPenalty")),
              });
              revalidatePath("/inventory/slotting/settings");
              redirect("/inventory/slotting/settings");
            }}
            className="space-y-6"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="abcAThreshold">{t("abcAThreshold")}</Label>
                <Input
                  id="abcAThreshold"
                  name="abcAThreshold"
                  type="number"
                  min={1}
                  max={99}
                  defaultValue={config?.abcAThreshold ?? 80}
                />
                <p className="text-xs text-muted-foreground">{t("abcAThresholdDesc")}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="abcBThreshold">{t("abcBThreshold")}</Label>
                <Input
                  id="abcBThreshold"
                  name="abcBThreshold"
                  type="number"
                  min={1}
                  max={99}
                  defaultValue={config?.abcBThreshold ?? 95}
                />
                <p className="text-xs text-muted-foreground">{t("abcBThresholdDesc")}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lookbackDays">{t("lookbackDays")}</Label>
                <Input
                  id="lookbackDays"
                  name="lookbackDays"
                  type="number"
                  min={1}
                  defaultValue={config?.lookbackDays ?? 90}
                />
                <p className="text-xs text-muted-foreground">{t("lookbackDaysDesc")}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weightPenalty">{t("weightPenalty")}</Label>
                <Input
                  id="weightPenalty"
                  name="weightPenalty"
                  type="number"
                  step={0.1}
                  min={0}
                  defaultValue={config?.weightPenalty ?? 1.0}
                />
                <p className="text-xs text-muted-foreground">{t("weightPenaltyDesc")}</p>
              </div>
            </div>

            <Button type="submit">{t("saveSettings")}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
