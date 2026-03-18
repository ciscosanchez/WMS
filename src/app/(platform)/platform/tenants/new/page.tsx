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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function NewTenantPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState("starter");
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
      const result = await createTenant(name, slug, plan);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(`Tenant "${name}" provisioned`);
        router.push("/platform/tenants");
      }
    } catch {
      toast.error("Provisioning failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Create Tenant" description="Provision a new tenant on the platform" />

      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Tenant Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium leading-none">
                  Tenant Name
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
                  Slug
                </label>
                <Input
                  id="slug"
                  placeholder="e.g. acme-warehousing"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Used in URLs and as the database schema prefix. Auto-generated from the name.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="plan" className="text-sm font-medium leading-none">
                  Plan
                </label>
                <select
                  id="plan"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="starter">Starter — $99/mo</option>
                  <option value="professional">Professional — $299/mo</option>
                  <option value="enterprise">Enterprise — $799/mo</option>
                </select>
              </div>

              {slug && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 text-blue-600" />
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-blue-900">Schema Creation</p>
                      <p className="text-blue-700">
                        Provisioning will create PostgreSQL schema{" "}
                        <code className="rounded bg-blue-100 px-1 py-0.5 text-xs font-mono">
                          tenant_{slug.replace(/-/g, "_")}
                        </code>{" "}
                        and run all migrations. This takes a few seconds.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={!name || !slug || loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Provisioning...
                  </>
                ) : (
                  "Provision Tenant"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
