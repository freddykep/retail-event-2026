"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hashAccessCode, normalizeAccessCode } from "@/lib/auth/access-code";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/auth/rate-limit";
import { getParticipantByAccessCode } from "@/lib/firestore/participants";
import { createParticipantSession, clearParticipantSession } from "@/lib/auth/participant-session";

export interface VerifyCodeState {
  error?: string;
}

export async function verifyAccessCode(
  _prevState: VerifyCodeState,
  formData: FormData
): Promise<VerifyCodeState> {
  const raw = String(formData.get("code") ?? "");
  const code = normalizeAccessCode(raw);
  if (!code) {
    return { error: "Bitte gib deinen Zugangscode ein." };
  }

  const headerList = await headers();
  const ip = clientIpFromHeaders(headerList);
  const rate = await checkRateLimit(`code:${ip}`);
  if (!rate.allowed) {
    return { error: "Zu viele Versuche. Bitte versuche es in einigen Minuten erneut." };
  }

  const participant = await getParticipantByAccessCode(hashAccessCode(code));
  if (!participant) {
    return { error: "Der Zugangscode ist ungültig." };
  }

  await createParticipantSession(participant.id);
  redirect("/workshops");
}

export async function logoutParticipant(): Promise<void> {
  await clearParticipantSession();
  redirect("/login");
}
