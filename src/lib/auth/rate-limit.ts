import "server-only";
import { adminDb } from "@/lib/firebase/admin";

const WINDOW_MS = 15 * 60 * 1000; // 15 Minuten
const MAX_ATTEMPTS_PER_WINDOW = 10;
const LOCKOUT_MS = 15 * 60 * 1000;

interface RateLimitDoc {
  count: number;
  windowStart: number;
  lockedUntil: number | null;
}

/**
 * Firestore-gestuetztes Rate-Limiting pro Schluessel (z.B. IP-Adresse). Best-effort
 * innerhalb der Grenzen einer serverlosen Umgebung - fuer produktiven Einsatz mit
 * hohem Traffic zusaetzlich ein Edge-Rate-Limiting (z.B. Vercel/Upstash) ergaenzen
 * (siehe README).
 */
export async function checkRateLimit(
  key: string
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const ref = adminDb.collection("rateLimits").doc(key);
  const now = Date.now();

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.data() as RateLimitDoc | undefined) ?? {
      count: 0,
      windowStart: now,
      lockedUntil: null,
    };

    if (data.lockedUntil && data.lockedUntil > now) {
      return { allowed: false, retryAfterMs: data.lockedUntil - now };
    }

    const windowExpired = now - data.windowStart > WINDOW_MS;
    const count = windowExpired ? 1 : data.count + 1;
    const windowStart = windowExpired ? now : data.windowStart;

    if (count > MAX_ATTEMPTS_PER_WINDOW) {
      tx.set(ref, { count, windowStart, lockedUntil: now + LOCKOUT_MS }, { merge: true });
      return { allowed: false, retryAfterMs: LOCKOUT_MS };
    }

    tx.set(ref, { count, windowStart, lockedUntil: null }, { merge: true });
    return { allowed: true };
  });
}

export async function resetRateLimit(key: string): Promise<void> {
  await adminDb.collection("rateLimits").doc(key).delete();
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
