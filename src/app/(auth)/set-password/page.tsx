import { Suspense } from "react";
import { SetPasswordForm } from "./form";

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p>Loading...</p></div>}>
      <SetPasswordForm />
    </Suspense>
  );
}
