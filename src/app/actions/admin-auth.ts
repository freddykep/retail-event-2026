"use server";

import { redirect } from "next/navigation";
import { createAdminSessionCookie, clearAdminSession, NotAdminError } from "@/lib/auth/admin-session";

export async function createAdminSession(idToken: string): Promise<{ error?: string }> {
  try {
    await createAdminSessionCookie(idToken);
    return {};
  } catch (err) {
    if (err instanceof NotAdminError) {
      return {
        error:
          "Dieser Account hat keine Admin-Berechtigung. Bitte an einen bestehenden Admin wenden.",
      };
    }
    return { error: "Anmeldung fehlgeschlagen. Bitte pruefe deine Berechtigung." };
  }
}

export async function logoutAdmin(): Promise<void> {
  await clearAdminSession();
  redirect("/admin/login");
}
