"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, KeyRound, Mail, MailX, ShieldAlert } from "lucide-react";
import { inviteUser } from "@/modules/users/actions";

type TenantRole = "admin" | "manager" | "warehouse_worker" | "viewer";

type AccessExperience = "standard" | "operator" | "portal";

type InviteFormData = {
  email: string;
  name: string;
  role: TenantRole;
  portalClientId: string;
  accessExperience: AccessExperience;
};

type PortalClientOption = {
  id: string;
  name: string;
  code: string;
};

function deriveRole(experience: AccessExperience, role: TenantRole): TenantRole {
  if (experience === "operator") return "warehouse_worker";
  if (experience === "portal") return "viewer";
  return role;
}

export function InviteUserClient({ clients }: { clients: PortalClientOption[] }) {
  const router = useRouter();
  const [result, setResult] = useState<{
    emailSent: boolean;
    emailWarning?: string;
    accessWarning?: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormData>({
    defaultValues: {
      email: "",
      name: "",
      role: "warehouse_worker",
      portalClientId: "",
      accessExperience: "standard",
    },
  });

  const accessExperience = useWatch({ control, name: "accessExperience" });
  const selectedRole = useWatch({ control, name: "role" });
  const selectedPortalClientId = useWatch({ control, name: "portalClientId" });
  const effectiveRole = deriveRole(accessExperience, selectedRole);
  const selectedClientLabel = useMemo(
    () => clients.find((client) => client.id === selectedPortalClientId),
    [clients, selectedPortalClientId]
  );

  async function onSubmit(data: InviteFormData) {
    const role = deriveRole(data.accessExperience, data.role);
    const portalClientId = data.accessExperience === "portal" ? data.portalClientId : null;

    if (data.accessExperience === "portal" && !portalClientId) {
      toast.error("Select a client to enable portal access");
      return;
    }

    const res = await inviteUser({
      email: data.email,
      name: data.name,
      role,
      portalClientId,
    });

    if ("error" in res) {
      toast.error(res.error);
      return;
    }

    setResult({
      emailSent: res.emailSent,
      emailWarning: res.emailWarning,
      accessWarning: res.accessWarning,
    });
    toast.success(`${data.name} added to the team`);
  }

  if (result) {
    return (
      <div className="max-w-2xl space-y-6">
        <PageHeader title="User Invited" />

        {result.emailSent ? (
          <div className="flex items-center gap-3 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <Mail className="h-4 w-4 shrink-0 text-green-600" />
            Invite email sent. The user can log in with their email address.
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <MailX className="h-4 w-4 shrink-0 text-amber-600" />
            {result.emailWarning ?? "Email not sent."}
          </div>
        )}

        {result.accessWarning && (
          <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            {result.accessWarning}
          </div>
        )}

        {result.emailSent && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="h-4 w-4" />
                Password Setup
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                The user will receive a secure link to set their own password. The link expires in
                48 hours.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button onClick={() => router.push("/settings/users")}>Done</Button>
          <Button variant="outline" onClick={() => setResult(null)}>
            Invite Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Invite User" description="Send an invitation to a new team member" />

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access Experience</CardTitle>
            <CardDescription>
              Choose the primary experience this user should land in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accessExperience">Experience *</Label>
              <select
                id="accessExperience"
                {...register("accessExperience")}
                onChange={(e) => setValue("accessExperience", e.target.value as AccessExperience)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="standard">Standard Team Member</option>
                <option value="operator">Operator / Floor App</option>
                <option value="portal">Portal User</option>
              </select>
            </div>

            {accessExperience === "standard" && (
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <select
                  id="role"
                  {...register("role")}
                  onChange={(e) => setValue("role", e.target.value as TenantRole)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="warehouse_worker">Warehouse Worker</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            )}

            {accessExperience === "portal" && (
              <div className="space-y-2">
                <Label htmlFor="portalClientId">Portal Client *</Label>
                <select
                  id="portalClientId"
                  {...register("portalClientId")}
                  onChange={(e) => setValue("portalClientId", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} ({client.code})
                    </option>
                  ))}
                </select>
                {selectedClientLabel ? (
                  <p className="text-xs text-muted-foreground">
                    This invite will create a viewer with portal access scoped to{" "}
                    {selectedClientLabel.name}.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Portal users are scoped to one client account and land in `/portal/inventory`.
                  </p>
                )}
              </div>
            )}

            {accessExperience === "operator" && (
              <p className="text-sm text-muted-foreground">
                Operators are invited as{" "}
                <span className="font-medium text-foreground">Warehouse Worker</span> and land in
                the floor app at <span className="font-medium text-foreground">/my-tasks</span>.
              </p>
            )}

            {accessExperience === "standard" && (
              <p className="text-sm text-muted-foreground">
                This user will be invited with the{" "}
                <span className="font-medium text-foreground">
                  {effectiveRole.replace(/_/g, " ")}
                </span>{" "}
                role and use the normal tenant experience.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Persona Mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Standard Team Member</span> uses one of
              the four stored tenant roles directly.
            </p>
            <p>
              <span className="font-medium text-foreground">Operator</span> is a
              <span className="font-medium text-foreground"> Warehouse Worker</span> persona with
              the floor app as the default landing experience.
            </p>
            <p>
              <span className="font-medium text-foreground">Portal User</span> is a
              <span className="font-medium text-foreground"> Viewer</span> plus a client binding.
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Inviting...
              </>
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
