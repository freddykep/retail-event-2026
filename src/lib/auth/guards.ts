import "server-only";
import { redirect } from "next/navigation";
import { getAdminSession, type AdminSession } from "@/lib/auth/admin-session";
import { getParticipantSession } from "@/lib/auth/participant-session";

/** Fuer Server Components unter /admin (ausser /admin/login). Verifiziert das
 * Session-Cookie kryptografisch inkl. Custom Claim `role: admin` - die Middleware
 * prueft nur, ob ueberhaupt ein Cookie vorhanden ist, keine Kryptografie. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}

export async function requireParticipant(): Promise<{ participantId: string }> {
  const session = await getParticipantSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/** Fuer Route Handler (app/api/**): liefert null statt zu redirecten, damit der
 * Aufrufer eine saubere 401-JSON-Antwort zurueckgeben kann. */
export async function requireAdminApi(): Promise<AdminSession | null> {
  return getAdminSession();
}

export async function requireParticipantApi(): Promise<{ participantId: string } | null> {
  return getParticipantSession();
}
