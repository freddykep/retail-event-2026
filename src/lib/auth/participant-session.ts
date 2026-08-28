import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

const COOKIE_NAME = "participant_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // 30 Tage

function secretKey() {
  return new TextEncoder().encode(env.sessionSecret);
}

export async function createParticipantSession(participantId: string): Promise<void> {
  const token = await new SignJWT({ participantId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function getParticipantSession(): Promise<{ participantId: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.participantId !== "string") return null;
    return { participantId: payload.participantId };
  } catch {
    return null;
  }
}

export async function clearParticipantSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
