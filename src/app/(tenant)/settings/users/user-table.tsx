"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/data-table";
import { SortableHeader } from "@/components/data-table/sortable-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  UserMinus,
  ShieldCheck,
  Link2,
  Link2Off,
  SlidersHorizontal,
  Warehouse,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  removeUser,
  updateUserPortalBinding,
  updateUserRole,
  assignWarehouseToUser,
  removeWarehouseAssignment,
  updateWarehouseAssignmentRole,
} from "@/modules/users/actions";
import type { TenantRole } from "../../../../../node_modules/.prisma/public-client";
import {
  getAccessRisks,
  getEffectivePermissions,
  normalizePermissionOverrides,
  type PermissionPreset,
  type AccessRisk,
  type PermissionOverrides,
} from "@/lib/auth/rbac";
import { PermissionOverridesDialog } from "./permission-overrides-dialog";
import { BulkApplyPresetDialog } from "./bulk-apply-preset-dialog";

type WarehouseAssignment = {
  warehouseId: string;
  role: TenantRole | null;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: TenantRole;
  personas: string[];
  portalClientId: string | null;
  portalClientName: string | null;
  portalClientCode: string | null;
  permissionOverrides: PermissionOverrides;
  risks: AccessRisk[];
  warehouseAssignments: WarehouseAssignment[];
  joinedAt: string;
};

type ClientOption = {
  id: string;
  name: string;
  code: string;
};

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  manager: "bg-blue-100 text-blue-700 border-blue-200",
  warehouse_worker: "bg-orange-100 text-orange-700 border-orange-200",
  viewer: "bg-gray-100 text-gray-700 border-gray-200",
};

const ROLES: TenantRole[] = ["admin", "manager", "warehouse_worker", "viewer"];

const personaColors: Record<string, string> = {
  superadmin: "bg-red-100 text-red-700 border-red-200",
  tenant_admin: "bg-red-100 text-red-700 border-red-200",
  tenant_manager: "bg-blue-100 text-blue-700 border-blue-200",
  warehouse_worker: "bg-orange-100 text-orange-700 border-orange-200",
  operator: "bg-amber-100 text-amber-700 border-amber-200",
  viewer: "bg-gray-100 text-gray-700 border-gray-200",
  portal_user: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function formatPersonaLabel(persona: string) {
  return persona.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function UserActions({
  user,
  clients,
  warehouses,
  users,
  savedPresets,
}: {
  user: UserRow;
  clients: ClientOption[];
  warehouses: WarehouseOption[];
  users: UserRow[];
  savedPresets: PermissionPreset[];
}) {
  const router = useRouter();
  const [permissionsOpen, setPermissionsOpen] = useState(false);

  const assignedIds = new Set(user.warehouseAssignments.map((wa) => wa.warehouseId));
  const assignedWarehouses = user.warehouseAssignments;
  const unassignedWarehouses = warehouses.filter((wh) => !assignedIds.has(wh.id));

  async function handleAssignWarehouse(warehouseId: string) {
    const result = await assignWarehouseToUser(user.id, warehouseId);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Warehouse assigned");
      router.refresh();
    }
  }

  async function handleRemoveWarehouse(warehouseId: string) {
    const result = await removeWarehouseAssignment(user.id, warehouseId);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Warehouse assignment removed");
      router.refresh();
    }
  }

  async function handleWarehouseRoleChange(warehouseId: string, role: TenantRole | null) {
    const result = await updateWarehouseAssignmentRole(user.id, warehouseId, role);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Warehouse role updated");
      router.refresh();
    }
  }

  async function handleRemove() {
    if (!confirm(`Remove ${user.name} from this tenant?`)) return;
    const result = await removeUser(user.id);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("User removed");
      router.refresh();
    }
  }

  async function handleRoleChange(role: TenantRole) {
    const result = await updateUserRole(user.id, role);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success("Role updated");
      router.refresh();
    }
  }

  async function handlePortalBinding(portalClientId: string | null) {
    const result = await updateUserPortalBinding(user.id, portalClientId);
    if ("error" in result) toast.error(result.error);
    else {
      toast.success(portalClientId ? "Portal access updated" : "Portal access removed");
      router.refresh();
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            Change role
          </DropdownMenuItem>
          {ROLES.filter((r) => r !== user.role).map((role) => (
            <DropdownMenuItem key={role} onClick={() => handleRoleChange(role)}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              {role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setPermissionsOpen(true)}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Custom Permissions
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Link2 className="mr-2 h-4 w-4" />
              Portal Access
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => handlePortalBinding(null)}>
                <Link2Off className="mr-2 h-4 w-4" />
                Disable Portal Access
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {clients.map((client) => (
                <DropdownMenuItem key={client.id} onClick={() => handlePortalBinding(client.id)}>
                  <Link2 className="mr-2 h-4 w-4" />
                  {client.name} ({client.code})
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Warehouse className="mr-2 h-4 w-4" />
              Warehouse Access
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {user.role === "admin" ? (
                <DropdownMenuItem disabled>Admin — unrestricted</DropdownMenuItem>
              ) : (
                <>
                  {unassignedWarehouses.map((wh) => (
                    <DropdownMenuItem key={wh.id} onClick={() => handleAssignWarehouse(wh.id)}>
                      <Square className="mr-2 h-4 w-4 text-muted-foreground" />
                      {wh.name}
                    </DropdownMenuItem>
                  ))}
                  {assignedWarehouses.length > 0 && unassignedWarehouses.length > 0 && (
                    <DropdownMenuSeparator />
                  )}
                  {assignedWarehouses.map((wa) => {
                    const wh = warehouses.find((w) => w.id === wa.warehouseId);
                    const roleLabel = wa.role
                      ? wa.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                      : "inherit";
                    return (
                      <DropdownMenuSub key={wa.warehouseId}>
                        <DropdownMenuSubTrigger>
                          <CheckSquare className="mr-2 h-4 w-4 text-green-600" />
                          <span className="flex-1">{wh?.name ?? wa.warehouseId}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{roleLabel}</span>
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                            Role at this warehouse
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleWarehouseRoleChange(wa.warehouseId, null)}>
                            Inherit tenant role
                          </DropdownMenuItem>
                          {ROLES.map((role) => (
                            <DropdownMenuItem
                              key={role}
                              onClick={() => handleWarehouseRoleChange(wa.warehouseId, role)}
                            >
                              {role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleRemoveWarehouse(wa.warehouseId)}
                          >
                            Remove assignment
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    );
                  })}
                  {warehouses.length === 0 && (
                    <DropdownMenuItem disabled>No warehouses configured</DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={handleRemove}>
            <UserMinus className="mr-2 h-4 w-4" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PermissionOverridesDialog
        key={`${user.id}-${permissionsOpen ? "open" : "closed"}-${user.permissionOverrides.grants.join(",")}-${user.permissionOverrides.denies.join(",")}`}
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
        user={user}
        users={users}
        savedPresets={savedPresets}
        onSaved={() => router.refresh()}
      />
    </>
  );
}

function getColumns(
  clients: ClientOption[],
  warehouses: WarehouseOption[],
  users: UserRow[],
  savedPresets: PermissionPreset[]
): ColumnDef<UserRow>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column} title="Name" />,
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "email",
      header: ({ column }) => <SortableHeader column={column} title="Email" />,
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const role = row.original.role;
        const label = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return (
          <Badge variant="outline" className={`font-medium ${roleColors[role] ?? ""}`}>
            {label}
          </Badge>
        );
      },
    },
    {
      id: "personas",
      header: "Personas",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.personas.map((persona) => (
            <Badge
              key={persona}
              variant="outline"
              className={`font-medium ${personaColors[persona] ?? "bg-muted text-foreground"}`}
            >
              {formatPersonaLabel(persona)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: "customAccess",
      header: "Custom Access",
      cell: ({ row }) => {
        const overrides = normalizePermissionOverrides(row.original.permissionOverrides);
        if (overrides.grants.length === 0 && overrides.denies.length === 0) {
          return <span className="text-sm text-muted-foreground">Role default</span>;
        }

        const effectiveCount = getEffectivePermissions(row.original.role, overrides).length;
        const risks = getAccessRisks({
          role: row.original.role,
          portalClientId: row.original.portalClientId,
          overrides,
        });
        return (
          <div className="space-y-0.5">
            <Badge variant="outline" className="bg-violet-100 text-violet-700 border-violet-200">
              Custom Access
            </Badge>
            <div className="text-xs text-muted-foreground">
              {overrides.grants.length} grants, {overrides.denies.length} denies, {effectiveCount}{" "}
              effective
            </div>
            {risks.length > 0 && (
              <div className="text-xs text-red-600">
                {risks.length} risk flag{risks.length > 1 ? "s" : ""}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "riskFlags",
      header: "Risk Flags",
      cell: ({ row }) =>
        row.original.risks.length === 0 ? (
          <span className="text-sm text-muted-foreground">No flags</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.original.risks.map((risk) => (
              <Badge
                key={risk.code}
                variant="outline"
                className={
                  risk.severity === "high"
                    ? "bg-red-100 text-red-700 border-red-200"
                    : "bg-amber-100 text-amber-700 border-amber-200"
                }
              >
                {risk.severity === "high" ? "High" : "Medium"}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      id: "portalAccess",
      header: "Portal Access",
      cell: ({ row }) => {
        if (!row.original.portalClientId) {
          return <span className="text-sm text-muted-foreground">Not enabled</span>;
        }

        return (
          <div className="space-y-0.5">
            <div className="font-medium">{row.original.portalClientName ?? "Bound client"}</div>
            <div className="text-xs text-muted-foreground">{row.original.portalClientCode}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "joinedAt",
      header: ({ column }) => <SortableHeader column={column} title="Joined" />,
      cell: ({ row }) =>
        new Date(row.original.joinedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
    },
    {
      id: "warehouseAccess",
      header: "Warehouse Access",
      cell: ({ row }) => {
        const { role, warehouseAssignments } = row.original;
        if (role === "admin") {
          return <span className="text-sm text-muted-foreground">All (admin)</span>;
        }
        if (warehouseAssignments.length === 0) {
          return <span className="text-sm text-muted-foreground">Unrestricted</span>;
        }
        return (
          <div className="space-y-0.5">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {warehouseAssignments.length}{" "}
              {warehouseAssignments.length === 1 ? "warehouse" : "warehouses"}
            </Badge>
            <div className="text-xs text-muted-foreground">
              {warehouseAssignments
                .map((wa) => {
                  const wh = warehouses.find((w) => w.id === wa.warehouseId);
                  return wh?.code ?? wa.warehouseId.slice(0, 8);
                })
                .join(", ")}
            </div>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <UserActions
          user={row.original}
          clients={clients}
          warehouses={warehouses}
          users={users}
          savedPresets={savedPresets}
        />
      ),
    },
  ];
}

export function UserTable({
  users,
  clients,
  warehouses,
  savedPresets,
  reviewCadenceDays,
  lastReviewCompletedAt,
  nextReviewDueAt,
}: {
  users: UserRow[];
  clients: ClientOption[];
  warehouses: WarehouseOption[];
  savedPresets: PermissionPreset[];
  reviewCadenceDays: number;
  lastReviewCompletedAt: string | null;
  nextReviewDueAt: string | null;
}) {
  const [governanceOpen, setGovernanceOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setGovernanceOpen(true)}>
          RBAC Governance
        </Button>
      </div>
      <DataTable
        columns={getColumns(clients, warehouses, users, savedPresets)}
        data={users}
        searchKey="name"
        searchPlaceholder="Search users..."
      />
      <BulkApplyPresetDialog
        open={governanceOpen}
        onOpenChange={setGovernanceOpen}
        users={users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }))}
        savedPresets={savedPresets}
        reviewCadenceDays={reviewCadenceDays}
        lastReviewCompletedAt={lastReviewCompletedAt}
        nextReviewDueAt={nextReviewDueAt}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
