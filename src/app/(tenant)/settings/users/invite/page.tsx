"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, KeyRound, Mail, MailX } from "lucide-react";
import { inviteUser } from "@/modules/users/actions";
import type { TenantRole } from "../../../../../../node_modules/.prisma/public-client";

type InviteFormData = {
  email: string;
  name: string;
  role: TenantRole;
};

export default function InviteUserPage() {
  const router = useRouter();
  const [result, setResult] = useState<{
    tempPassword: string | null;
    emailSent: boolean;
    emailWarning?: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormData>({ defaultValues: { email: "", name: "", role: "warehouse_worker" } });

  async function onSubmit(data: InviteFormData) {
    const res = await inviteUser(data);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setResult({
      tempPassword: res.tempPassword,
      emailSent: res.emailSent,
      emailWarning: res.emailWarning,
    });
    toast.success(`${data.name} added to the team`);
  }

  if (result) {
    return (
      <div className="space-y-6 max-w-2xl">
        <PageHeader title="User Invited" />

        {result.emailSent ? (
          <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <Mail className="h-4 w-4 text-green-600 shrink-0" />
            Invite email sent. The user can log in with their email address.
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <MailX className="h-4 w-4 text-amber-600 shrink-0" />
            {result.emailWarning ?? "Email not sent."}
          </div>
        )}

        {result.tempPassword && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4" />
                Temporary Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Share this with the user. They should change it on first login.
              </p>
              <code className="block rounded-md bg-muted px-4 py-3 text-lg font-mono tracking-widest">
                {result.tempPassword}
              </code>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button onClick={() => router.push("/settings/users")}>Done</Button>
          <Button variant="outline" onClick={() => { setResult(null); }}>
            Invite Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Invite User" description="Send an invitation to a new team member" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>User Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                {...register("email", { required: "Email is required" })}
                placeholder="user@company.com"
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                {...register("name", { required: "Name is required" })}
                placeholder="John Doe"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Role *</Label>
              <select
                required
                defaultValue="warehouse_worker"
                onChange={(e) => setValue("role", e.target.value as TenantRole)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="warehouse_worker">Warehouse Worker</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Inviting...</>
            ) : (
              "Send Invite"
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
