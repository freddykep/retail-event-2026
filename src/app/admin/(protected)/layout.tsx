import { requireAdmin } from "@/lib/auth/guards";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="min-h-screen bg-adesso-grey-lighter">
      <AdminNav email={session.email} />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">{children}</div>
    </div>
  );
}
