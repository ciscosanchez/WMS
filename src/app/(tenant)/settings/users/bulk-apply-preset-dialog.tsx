"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  bulkApplyPermissionPreset,
  deleteTenantPermissionPreset,
  markTenantAccessReviewComplete,
  saveTenantAccessReviewCadence,
} from "@/modules/users/actions";
import {
  getPermissionPreset,
  PERMISSION_PRESETS,
  type PermissionPreset,
} from "@/lib/auth/rbac";

type UserOption = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export function BulkApplyPresetDialog({
  open,
  onOpenChange,
  users,
  savedPresets,
  reviewCadenceDays,
  lastReviewCompletedAt,
  nextReviewDueAt,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserOption[];
  savedPresets: PermissionPreset[];
  reviewCadenceDays: number;
  lastReviewCompletedAt: string | null;
  nextReviewDueAt: string | null;
  onSaved: () => void;
}) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedPresetKey, setSelectedPresetKey] = useState("");
  const [selectedCadence, setSelectedCadence] = useState(String(reviewCadenceDays));
  const [isSaving, setIsSaving] = useState(false);

  const allPresets = useMemo(
    () => [...savedPresets, ...PERMISSION_PRESETS.filter((preset) => !savedPresets.some((saved) => saved.key === preset.key))],
    [savedPresets]
  );

  function toggleUser(userId: string, checked: boolean) {
    setSelectedUserIds((current) =>
      checked ? [...new Set([...current, userId])] : current.filter((id) => id !== userId)
    );
  }

  async function handleBulkApply() {
    const preset =
      savedPresets.find((item) => item.key === selectedPresetKey) ?? getPermissionPreset(selectedPresetKey);
    if (!preset) {
      toast.error("Select a preset");
      return;
    }

    setIsSaving(true);
    const result = await bulkApplyPermissionPreset({
      userIds: selectedUserIds,
      grants: preset.grants,
      denies: preset.denies,
    });
    setIsSaving(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success(`Updated ${result.updated} user${result.updated === 1 ? "" : "s"}`);
    onOpenChange(false);
    onSaved();
  }

  async function handleDeletePreset(presetKey: string) {
    const result = await deleteTenantPermissionPreset(presetKey);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Saved preset deleted");
    onSaved();
  }

  async function handleSaveCadence() {
    const result = await saveTenantAccessReviewCadence(Number(selectedCadence));
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Review cadence updated");
    onSaved();
  }

  async function handleMarkReviewComplete() {
    const result = await markTenantAccessReviewComplete();
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Access review marked complete");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>RBAC Governance</DialogTitle>
          <DialogDescription>
            Apply saved presets in bulk and manage the tenant access-review cadence.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="text-sm font-medium">Review Cadence</div>
            <select
              value={selectedCadence}
              onChange={(event) => setSelectedCadence(event.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="30">Every 30 days</option>
              <option value="60">Every 60 days</option>
              <option value="90">Every 90 days</option>
              <option value="180">Every 180 days</option>
            </select>
            <div className="text-xs text-muted-foreground">
              Last review: {lastReviewCompletedAt ? new Date(lastReviewCompletedAt).toLocaleDateString() : "Not recorded"}
              <br />
              Next due: {nextReviewDueAt ? new Date(nextReviewDueAt).toLocaleDateString() : "Not scheduled"}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSaveCadence}>
                Save Cadence
              </Button>
              <Button variant="outline" onClick={handleMarkReviewComplete}>
                Mark Review Complete
              </Button>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="text-sm font-medium">Saved Tenant Presets</div>
            {savedPresets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tenant-specific presets yet.</p>
            ) : (
              savedPresets.map((preset) => (
                <div key={preset.key} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div>
                    <div className="font-medium">{preset.label}</div>
                    <div className="text-xs text-muted-foreground">{preset.description}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleDeletePreset(preset.key)}>
                    Delete
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <div className="text-sm font-medium">Bulk Apply Preset</div>
          <select
            value={selectedPresetKey}
            onChange={(event) => setSelectedPresetKey(event.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="">Select a preset</option>
            {allPresets.map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.label}
              </option>
            ))}
          </select>

          <div className="grid gap-2 md:grid-cols-2">
            {users.map((user) => (
              <label key={user.id} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                <Checkbox
                  checked={selectedUserIds.includes(user.id)}
                  onCheckedChange={(checked) => toggleUser(user.id, Boolean(checked))}
                />
                <span>
                  {user.name} <span className="text-muted-foreground">({user.role.replace(/_/g, " ")})</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Close
          </Button>
          <Button onClick={handleBulkApply} disabled={isSaving || selectedUserIds.length === 0 || !selectedPresetKey}>
            Apply Preset To Selected Users
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
