"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { createAdminSession } from "@/app/actions/admin-auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const credential = await signInWithEmailAndPassword(clientAuth, email, password);
      const idToken = await credential.user.getIdToken();
      const result = await createAdminSession(idToken);
      if (result.error) {
        setError(result.error);
        setPending(false);
        return;
      }
      router.push(searchParams.get("redirect") || "/admin");
      router.refresh();
    } catch {
      setError("E-Mail oder Passwort ist falsch.");
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-sm p-8">
      <h1 className="font-heading mb-6 text-xl font-bold text-adesso-blue-4">Admin-Login</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-adesso-blue-4">E-Mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-adesso-grey px-4 py-2.5 focus:border-adesso-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-adesso-blue-4">Passwort</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-adesso-grey px-4 py-2.5 focus:border-adesso-primary focus:outline-none"
          />
        </div>
        {error && <p className="text-sm font-medium text-adesso-error">{error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Wird geprüft…" : "Anmelden"}
        </Button>
      </form>
    </Card>
  );
}
