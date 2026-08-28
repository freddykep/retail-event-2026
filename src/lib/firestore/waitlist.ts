import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { WaitlistEntryDoc } from "@/types/registration";

const COLLECTION = "waitlistEntries";

export async function listWaitlistEntries(): Promise<WaitlistEntryDoc[]> {
  const snap = await adminDb.collection(COLLECTION).orderBy("position", "asc").get();
  return snap.docs.map((d) => d.data() as WaitlistEntryDoc);
}

export async function getWaitlistEntry(participantId: string): Promise<WaitlistEntryDoc | null> {
  const snap = await adminDb.collection(COLLECTION).doc(participantId).get();
  if (!snap.exists) return null;
  return snap.data() as WaitlistEntryDoc;
}

export function waitlistPositionForWorkshop(
  entries: WaitlistEntryDoc[],
  workshopId: string
): WaitlistEntryDoc[] {
  return entries
    .filter((e) => e.workshopIds.includes(workshopId))
    .sort((a, b) => a.position - b.position);
}
