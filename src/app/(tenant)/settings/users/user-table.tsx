"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
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
import { MoreHorizontal, UserMinus, ShieldCheck, Link2, Link2Off, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { removeUser, updateUserPortalBinding, updateUserRole } from "@/modules/users/actions";
import type { TenantRole } from "../../../../../node_modules/.prisma/public-client";
import { getEffectivePermissions, normalizePermissionOverrides, type PermissionOverrides } from "@/lib/auth/rbac";
import { PermissionOverridesDialog } from "./permission-overrides-dialog";

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
  joinedAt: string;
};

type ClientOption = {
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

function UserActions({ user, clients }: { user: UserRow; clients: ClientOption[] }) {
  const router = useRouter();
  const [permissionsOpen, setPermissionsOpen] = useState(false);

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
            <DropdownMenuItem key={role} onSelect={() => handleRoleChange(role)}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              {role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setPermissionsOpen(true)}>
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
              <DropdownMenuItem onSelect={() => handlePortalBinding(null)}>
                <Link2Off className="mr-2 h-4 w-4" />
                Disable Portal Access
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {clients.map((client) => (
                <DropdownMenuItem key={client.id} onSelect={() => handlePortalBinding(client.id)}>
                  <Link2 className="mr-2 h-4 w-4" />
                  {client.name} ({client.code})
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={handleRemove}>
            <UserMinus className="mr-2 h-4 w-4" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PermissionOverridesDialog
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
        user={user}
        onSaved={() => router.refresh()}
      />
    </>
  );
}

function getColumns(clients: ClientOption[]): ColumnDef<UserRow>[] {
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
      return (
        <div className="space-y-0.5">
          <Badge variant="outline" className="bg-violet-100 text-violet-700 border-violet-200">
            Custom Access
          </Badge>
          <div className="text-xs text-muted-foreground">
            {overrides.grants.length} grants, {overrides.denies.length} denies, {effectiveCount} effective
          </div>
        </div>
      );
    },
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
    id: "actions",
    header: "",
    cell: ({ row }) => <UserActions user={row.original} clients={clients} />,
  },
  ];
}

export function UserTable({ users, clients }: { users: UserRow[]; clients: ClientOption[] }) {
  return (
    <DataTable
      columns={getColumns(clients)}
      data={users}
      searchKey="name"
      searchPlaceholder="Search users..."
    />
  );
}
