import { Suspense } from "react";
import { ResetPasswordForm } from "./form";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
