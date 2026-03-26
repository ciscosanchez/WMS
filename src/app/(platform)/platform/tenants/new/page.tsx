"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createTenant } from "@/modules/platform/actions";
import type { TenantPlan } from "../../../../../../node_modules/.prisma/public-client";
import { useTranslations } from "next-intl";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function NewTenantPage() {
  const t = useTranslations("platform.tenants");
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState<TenantPlan>("starter");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const handleSlugChange = (value: string) => {
    setSlugTouched(true);
    setSlug(slugify(value));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await createTenant(
        name,
        slug,
        plan,
        adminEmail || undefined,
        adminName || undefined
      );
      if ("error" in result) {
        toast.error(result.error);
      } else {
        const msg = result.adminInvited
          ? `${t("tenantProvisioned")}: "${name}" — admin invite sent to ${adminEmail}`
          : `${t("tenantProvisioned")}: "${name}"`;
        toast.success(msg);
        router.push("/platform/tenants");
      }
    } catch {
      toast.error(t("provisioningFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("createTenant")} description={t("createTenantDesc")} />

      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>{t("tenantDetails")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium leading-none">
                  {t("tenantName")}
                </label>
                <Input
                  id="name"
                  placeholder="e.g. Acme Warehousing"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="slug" className="text-sm font-medium leading-none">
                  {t("slug")}
                </label>
                <Input
                  id="slug"
                  placeholder="e.g. acme-warehousing"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">{t("slugDesc")}</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="plan" className="text-sm font-medium leading-none">
                  {t("plan")}
                </label>
                <select
                  id="plan"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as TenantPlan)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="starter">{t("starter")}</option>
                  <option value="professional">{t("professional")}</option>
                  <option value="enterprise">{t("enterprise")}</option>
                </select>
              </div>

              <div className="space-y-4 rounded-md border p-4">
                <p className="text-sm font-medium">Initial Admin (optional)</p>
                <p className="text-xs text-muted-foreground">
                  Creates an admin user and sends them an invite email to set their password.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="adminEmail" className="text-sm font-medium leading-none">
                      Admin Email
                    </label>
                    <Input
                      id="adminEmail"
                      type="email"
                      placeholder="admin@company.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="adminName" className="text-sm font-medium leading-none">
                      Admin Name
                    </label>
                    <Input
                      id="adminName"
                      placeholder="Jane Smith"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {slug && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 text-blue-600" />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-blue-900">{t("schemaCreation")}</p>
                      <p className="text-blue-700">
                        {t("schemaDesc")}{" "}
                        <code className="rounded bg-blue-100 px-1 py-0.5 text-xs font-mono">
                          tenant_{slug.replace(/-/g, "_")}
                        </code>{" "}
                        {t("schemaDescSuffix")}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={!name || !slug || loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("provisioning")}
                  </>
                ) : (
                  t("provisionTenant")
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
