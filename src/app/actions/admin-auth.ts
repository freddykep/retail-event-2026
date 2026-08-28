"use server";

import { redirect } from "next/navigation";
import { createAdminSessionCookie, clearAdminSession } from "@/lib/auth/admin-session";

export async function createAdminSession(idToken: string): Promise<{ error?: string }> {
  try {
    await createAdminSessionCookie(idToken);
    return {};
  } catch {
    return { error: "Anmeldung fehlgeschlagen. Bitte pruefe deine Berechtigung." };
  }
}

export async function logoutAdmin(): Promise<void> {
  await clearAdminSession();
  redirect("/admin/login");
}
