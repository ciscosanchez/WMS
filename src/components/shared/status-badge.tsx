import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  // Shipment statuses
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  expected: "bg-blue-100 text-blue-700 border-blue-200",
  arrived: "bg-yellow-100 text-yellow-700 border-yellow-200",
  receiving: "bg-orange-100 text-orange-700 border-orange-200",
  inspection: "bg-purple-100 text-purple-700 border-purple-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  // Adjustment statuses
  pending_approval: "bg-yellow-100 text-yellow-700 border-yellow-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  // Discrepancy statuses
  open: "bg-red-100 text-red-700 border-red-200",
  investigating: "bg-yellow-100 text-yellow-700 border-yellow-200",
  resolved: "bg-green-100 text-green-700 border-green-200",
  closed: "bg-gray-100 text-gray-700 border-gray-200",
  // Bin statuses
  available: "bg-green-100 text-green-700 border-green-200",
  full: "bg-red-100 text-red-700 border-red-200",
  reserved: "bg-yellow-100 text-yellow-700 border-yellow-200",
  blocked: "bg-gray-100 text-gray-700 border-gray-200",
  // Conditions
  good: "bg-green-100 text-green-700 border-green-200",
  damaged: "bg-red-100 text-red-700 border-red-200",
  quarantine: "bg-purple-100 text-purple-700 border-purple-200",
  // Inspection
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  passed: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  waived: "bg-gray-100 text-gray-700 border-gray-200",
  // Tenant
  active: "bg-green-100 text-green-700 border-green-200",
  invited: "bg-blue-100 text-blue-700 border-blue-200",
  suspended: "bg-red-100 text-red-700 border-red-200",
  provisioning: "bg-yellow-100 text-yellow-700 border-yellow-200",
  // Order statuses
  awaiting_fulfillment: "bg-blue-100 text-blue-700 border-blue-200",
  allocated: "bg-cyan-100 text-cyan-700 border-cyan-200",
  picking: "bg-orange-100 text-orange-700 border-orange-200",
  picked: "bg-amber-100 text-amber-700 border-amber-200",
  packing: "bg-violet-100 text-violet-700 border-violet-200",
  packed: "bg-indigo-100 text-indigo-700 border-indigo-200",
  shipped: "bg-green-100 text-green-700 border-green-200",
  delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  on_hold: "bg-yellow-100 text-yellow-700 border-yellow-200",
  backordered: "bg-red-100 text-red-700 border-red-200",
  label_created: "bg-blue-100 text-blue-700 border-blue-200",
  // Pick statuses
  assigned: "bg-blue-100 text-blue-700 border-blue-200",
  in_progress: "bg-orange-100 text-orange-700 border-orange-200",
  short_picked: "bg-red-100 text-red-700 border-red-200",
  // Transaction types
  receive: "bg-green-100 text-green-700 border-green-200",
  putaway: "bg-blue-100 text-blue-700 border-blue-200",
  move: "bg-cyan-100 text-cyan-700 border-cyan-200",
  adjust: "bg-yellow-100 text-yellow-700 border-yellow-200",
  count: "bg-purple-100 text-purple-700 border-purple-200",
  // Discrepancy types
  shortage: "bg-red-100 text-red-700 border-red-200",
  overage: "bg-yellow-100 text-yellow-700 border-yellow-200",
  damage: "bg-orange-100 text-orange-700 border-orange-200",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorClass = statusColors[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Badge variant="outline" className={cn("font-medium capitalize", colorClass, className)}>
      {label}
    </Badge>
  );
}
