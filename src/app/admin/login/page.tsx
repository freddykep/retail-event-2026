import { Suspense } from "react";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { AdessoLogo } from "@/components/ui/AdessoLogo";

export default function AdminLoginPage() {
  return (
    <main className="bg-event-gradient flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <AdessoLogo className="h-6 w-auto text-white/90" />
      <Suspense>
        <AdminLoginForm />
      </Suspense>
    </main>
  );
}
