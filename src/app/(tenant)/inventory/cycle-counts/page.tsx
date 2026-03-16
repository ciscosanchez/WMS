import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Plus, ListChecks } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function CycleCountsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Cycle Counts" description="Schedule and execute inventory counts">
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Count Plan
        </Button>
      </PageHeader>

      <EmptyState
        icon={ListChecks}
        title="No cycle count plans"
        description="Create a cycle count plan to schedule recurring inventory counts."
      />
    </div>
  );
}
