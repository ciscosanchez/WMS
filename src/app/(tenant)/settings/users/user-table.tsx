"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/data-table";
import { SortableHeader } from "@/components/data-table/sortable-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, UserMinus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { removeUser, updateUserRole } from "@/modules/users/actions";
import type { TenantRole } from "../../../../../node_modules/.prisma/public-client";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: TenantRole;
  joinedAt: string;
};

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-700 border-red-200",
  manager: "bg-blue-100 text-blue-700 border-blue-200",
  warehouse_worker: "bg-orange-100 text-orange-700 border-orange-200",
  viewer: "bg-gray-100 text-gray-700 border-gray-200",
};

const ROLES: TenantRole[] = ["admin", "manager", "warehouse_worker", "viewer"];

function UserActions({ user }: { user: UserRow }) {
  const router = useRouter();

  async function handleRemove() {
    if (!confirm(`Remove ${user.name} from this tenant?`)) return;
    const result = await removeUser(user.id);
    if ("error" in result) toast.error(result.error);
    else { toast.success("User removed"); router.refresh(); }
  }

  async function handleRoleChange(role: TenantRole) {
    const result = await updateUserRole(user.id, role);
    if ("error" in result) toast.error(result.error);
    else { toast.success("Role updated"); router.refresh(); }
  }

  return (
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
        <DropdownMenuItem variant="destructive" onSelect={handleRemove}>
          <UserMinus className="mr-2 h-4 w-4" />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const columns: ColumnDef<UserRow>[] = [
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
    cell: ({ row }) => <UserActions user={row.original} />,
  },
];

export function UserTable({ users }: { users: UserRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={users}
      searchKey="name"
      searchPlaceholder="Search users..."
    />
  );
}
