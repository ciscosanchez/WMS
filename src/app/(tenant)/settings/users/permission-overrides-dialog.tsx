"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getEffectivePermissions,
  getPermissionDiffSummary,
  getPermissionLabel,
  getPermissionPreset,
  getAccessRisks,
  getPermissions,
  normalizePermissionOverrides,
  PERMISSION_GROUPS,
  PERMISSION_PRESETS,
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
    portalClientId?: string | null;
    permissionOverrides: PermissionOverrides;
  };
  users: Array<{
    id: string;
    name: string;
    role: TenantRole;
    permissionOverrides: PermissionOverrides;
  }>;
  onSaved: () => void;
};

export function PermissionOverridesDialog({
  open,
  onOpenChange,
  user,
  users,
  onSaved,
}: PermissionOverridesDialogProps) {
  const normalized = useMemo(
    () => normalizePermissionOverrides(user.permissionOverrides),
    [user.permissionOverrides]
  );
  const [grants, setGrants] = useState<Permission[]>(normalized.grants);
  const [denies, setDenies] = useState<Permission[]>(normalized.denies);
  const [isSaving, setIsSaving] = useState(false);
  const [copySourceId, setCopySourceId] = useState("");
  const [presetKey, setPresetKey] = useState("");

  const basePermissions = useMemo(() => new Set(getPermissions(user.role)), [user.role]);
  const effectivePermissions = useMemo(
    () => new Set(getEffectivePermissions(user.role, { grants, denies })),
    [user.role, grants, denies]
  );
  const diff = useMemo(
    () => getPermissionDiffSummary(user.role, { grants, denies }),
    [user.role, grants, denies]
  );
  const risks = useMemo(
    () => getAccessRisks({ role: user.role, portalClientId: user.portalClientId, overrides: { grants, denies } }),
    [user.role, user.portalClientId, grants, denies]
  );

  function resetToRoleDefaults() {
    setGrants([]);
    setDenies([]);
    setCopySourceId("");
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

  function handleCopyFromUser(sourceUserId: string) {
    setCopySourceId(sourceUserId);
    const source = users.find((candidate) => candidate.id === sourceUserId);
    if (!source) return;

    const sourceOverrides = normalizePermissionOverrides(source.permissionOverrides);
    setGrants(sourceOverrides.grants);
    setDenies(sourceOverrides.denies);
  }

  function handleApplyPreset(nextPresetKey: string) {
    setPresetKey(nextPresetKey);
    const preset = getPermissionPreset(nextPresetKey);
    if (!preset) return;
    setGrants(preset.grants);
    setDenies(preset.denies);
  }

  const customOnlyCount = grants.length + denies.length;
  const inheritedCount = getPermissions(user.role).length;
  const copyCandidates = users.filter((candidate) => candidate.id !== user.id);

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

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium">Permission Diff</div>
            <div className="mt-2 text-sm text-muted-foreground">
              {customOnlyCount === 0
                ? "This user currently matches the base role exactly."
                : `${grants.length} additive grants and ${denies.length} explicit denials are applied on top of ${inheritedCount} inherited role permissions.`}
            </div>
            {(diff.added.length > 0 || diff.removed.length > 0) && (
              <div className="mt-2 text-xs text-muted-foreground">
                {diff.added.length > 0 ? `${diff.added.length} permissions added.` : "No added permissions."}{" "}
                {diff.removed.length > 0 ? `${diff.removed.length} permissions removed.` : "No removed permissions."}
              </div>
            )}
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium">Copy Custom Access</div>
            <div className="mt-2 space-y-2">
              <select
                value={copySourceId}
                onChange={(event) => handleCopyFromUser(event.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select another user</option>
                {copyCandidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} ({candidate.role.replace(/_/g, " ")})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Copies grants and denies only. The base role does not change.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium">Apply Preset</div>
            <div className="mt-2 space-y-2">
              <select
                value={presetKey}
                onChange={(event) => handleApplyPreset(event.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select a preset</option>
                {PERMISSION_PRESETS.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Reusable override bundles for common exception cases.
              </p>
            </div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium">Risk Review</div>
            <div className="mt-2 space-y-2">
              {risks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No current risk flags.</p>
              ) : (
                risks.map((risk) => (
                  <div key={risk.code} className="text-sm text-muted-foreground">
                    <span className={risk.severity === "high" ? "font-medium text-red-600" : "font-medium text-amber-600"}>
                      {risk.severity === "high" ? "High" : "Medium"}:
                    </span>{" "}
                    {risk.message}
                  </div>
                ))
              )}
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
