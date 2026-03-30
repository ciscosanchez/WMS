"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Truck, PackageCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  shipTransfer,
  receiveTransfer,
  completeTransfer,
} from "@/modules/transfers/execution";

interface TransferActionsProps {
  transferId: string;
  transferNumber: string;
  status: string;
  fromWarehouseName: string;
  toWarehouseName: string;
  lineCount: number;
}

const ACTION_CONFIG: Record<
  string,
  {
    label: string;
    description: string;
    targetStatus: string;
    icon: typeof Truck;
    variant: "default" | "outline";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    action: (id: string) => Promise<any>;
  }
> = {
  approved: {
    label: "Ship Transfer",
    description:
      "This will decrement inventory at the source warehouse and mark the transfer as in transit. This action cannot be undone.",
    targetStatus: "in_transit",
    icon: Truck,
    variant: "default",
    action: shipTransfer,
  },
  in_transit: {
    label: "Receive Transfer",
    description:
      "This will add inventory to the destination warehouse receiving area. Verify all items have arrived before confirming.",
    targetStatus: "received",
    icon: PackageCheck,
    variant: "default",
    action: receiveTransfer,
  },
  received: {
    label: "Complete Transfer",
    description:
      "This will finalize the transfer. All lines must be fully received. This action cannot be undone.",
    targetStatus: "completed",
    icon: CheckCircle2,
    variant: "default",
    action: completeTransfer,
  },
};

export function TransferActions({
  transferId,
  transferNumber,
  status,
  fromWarehouseName,
  toWarehouseName,
  lineCount,
}: TransferActionsProps) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [isPending, startTransition] = useTransition();
  const config = ACTION_CONFIG[currentStatus];

  function handleExecute() {
    if (!config) return;

    startTransition(async () => {
      try {
        await config.action(transferId);
        setCurrentStatus(config.targetStatus);
        toast.success(
          `Transfer ${transferNumber} is now ${config.targetStatus.replace("_", " ")}`
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Action failed"
        );
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Transfer Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Transfer Number</p>
            <p className="font-mono font-medium">{transferNumber}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <StatusBadge status={currentStatus} />
          </div>
          <div>
            <p className="text-muted-foreground">From</p>
            <p className="font-medium">{fromWarehouseName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">To</p>
            <p className="font-medium">{toWarehouseName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Lines</p>
            <p className="font-medium">{lineCount}</p>
          </div>
        </div>

        {/* Action Button with Confirmation */}
        {config ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  className="w-full"
                  variant={config.variant}
                  disabled={isPending}
                >
                  <config.icon className="mr-2 h-4 w-4" />
                  {isPending ? "Processing..." : config.label}
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{config.label}</AlertDialogTitle>
                <AlertDialogDescription>
                  {config.description}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleExecute}>
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <div className="rounded-md bg-muted p-3 text-center text-sm text-muted-foreground">
            {currentStatus === "completed"
              ? "This transfer has been completed."
              : currentStatus === "cancelled"
                ? "This transfer has been cancelled."
                : currentStatus === "draft"
                  ? "This transfer must be approved before execution."
                  : "No actions available for this status."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
