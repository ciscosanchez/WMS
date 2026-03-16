import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <EmptyState
        icon={FileQuestion}
        title="Page not found"
        description="The page you are looking for does not exist or has been moved."
      >
        <Button asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </EmptyState>
    </div>
  );
}
