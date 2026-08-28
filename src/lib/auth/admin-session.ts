import "server-only";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";

const COOKIE_NAME = "admin_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 5; // 5 Tage

export class NotAdminError extends Error {}

export async function createAdminSessionCookie(idToken: string): Promise<void> {
  // Muss VOR dem Erzeugen des Session-Cookies geprueft werden: createSessionCookie
  // wuerde sonst fuer JEDEN gueltigen Firebase-Nutzer ein Cookie ausstellen (auch ohne
  // Admin-Custom-Claim) - requireAdmin() wuerde das spaeter zwar korrekt ablehnen, aber
  // nur mit einem stillen Redirect zurueck zum Login, ohne erklaerende Fehlermeldung.
  const decoded = await adminAuth.verifyIdToken(idToken);
  if (decoded.role !== "admin") {
    throw new NotAdminError();
  }

  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION_MS,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

export interface AdminSession {
  uid: string;
  email: string | null;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    if (decoded.role !== "admin") return null;
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
