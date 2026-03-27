"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getEffectivePermissions,
  getPermissionLabel,
  getPermissions,
  normalizePermissionOverrides,
  PERMISSION_GROUPS,
  type Permission,
  type PermissionOverrides,
} from "@/lib/auth/rbac";
import type { TenantRole } from "../../../../../node_modules/.prisma/public-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { updateUserPermissionOverrides } from "@/modules/users/actions";

type PermissionOverridesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    name: string;
    role: TenantRole;
    permissionOverrides: PermissionOverrides;
  };
  onSaved: () => void;
};

export function PermissionOverridesDialog({
  open,
  onOpenChange,
  user,
  onSaved,
}: PermissionOverridesDialogProps) {
  const normalized = useMemo(
    () => normalizePermissionOverrides(user.permissionOverrides),
    [user.permissionOverrides]
  );
  const [grants, setGrants] = useState<Permission[]>(normalized.grants);
  const [denies, setDenies] = useState<Permission[]>(normalized.denies);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setGrants(normalized.grants);
    setDenies(normalized.denies);
  }, [normalized]);

  const basePermissions = useMemo(() => new Set(getPermissions(user.role)), [user.role]);
  const effectivePermissions = useMemo(
    () => new Set(getEffectivePermissions(user.role, { grants, denies })),
    [user.role, grants, denies]
  );

  function resetToRoleDefaults() {
    setGrants([]);
    setDenies([]);
  }

  function toggleGrant(permission: Permission, checked: boolean) {
    setGrants((current) =>
      checked ? [...new Set([...current, permission])] : current.filter((item) => item !== permission)
    );
    if (checked) {
      setDenies((current) => current.filter((item) => item !== permission));
    }
  }

  function toggleDeny(permission: Permission, checked: boolean) {
    setDenies((current) =>
      checked ? [...new Set([...current, permission])] : current.filter((item) => item !== permission)
    );
    if (checked) {
      setGrants((current) => current.filter((item) => item !== permission));
    }
  }

  async function handleSave() {
    setIsSaving(true);
    const result = await updateUserPermissionOverrides(user.id, { grants, denies });
    setIsSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Custom permissions updated");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Custom Permissions</DialogTitle>
          <DialogDescription>
            {user.name} keeps the <span className="font-medium text-foreground">{user.role.replace(/_/g, " ")}</span>
            {" "}role, then gets additive grants and explicit denials. Deny wins over the base role.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium">Base Role</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {getPermissions(user.role).length} inherited permissions
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium">Custom Grants</div>
            <div className="mt-1 text-sm text-muted-foreground">{grants.length} extra permissions</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium">Effective Access</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {effectivePermissions.size} total permissions
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.key} className="rounded-lg border">
              <div className="border-b px-4 py-3">
                <div className="font-medium">{group.label}</div>
              </div>
              <div className="space-y-3 p-4">
                {group.permissions.map((permission) => {
                  const inherited = basePermissions.has(permission);
                  const granted = grants.includes(permission);
                  const denied = denies.includes(permission);
                  const effective = effectivePermissions.has(permission);

                  return (
                    <div key={permission} className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                      <div>
                        <div className="font-medium">{getPermissionLabel(permission)}</div>
                        <div className="text-xs text-muted-foreground">
                          {effective ? "Effective" : "Blocked"}
                          {inherited ? " · inherited from role" : ""}
                          {granted ? " · granted" : ""}
                          {denied ? " · denied" : ""}
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={granted}
                          onCheckedChange={(checked) => toggleGrant(permission, Boolean(checked))}
                        />
                        Grant
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={denied}
                          onCheckedChange={(checked) => toggleDeny(permission, Boolean(checked))}
                        />
                        Deny
                      </label>
                      <div className="text-right text-xs text-muted-foreground">
                        {inherited ? "Role default" : "Not in role"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetToRoleDefaults} disabled={isSaving}>
            Reset To Role Defaults
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
