import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { AllocationMode, EventConfig } from "@/types/assignment";

const CONFIG_REF = adminDb.collection("event").doc("config");

export async function getEventConfig(): Promise<EventConfig> {
  const snap = await CONFIG_REF.get();
  const data = snap.data() ?? {};
  return {
    registrationOpen: data.registrationOpen ?? true,
    assignmentPublished: data.assignmentPublished ?? false,
    allocationMode: data.allocationMode ?? "fair",
    draftMeta: data.draftMeta ?? null,
  };
}

export async function setRegistrationOpen(open: boolean): Promise<void> {
  await CONFIG_REF.set({ registrationOpen: open }, { merge: true });
}

export async function setAllocationMode(mode: AllocationMode): Promise<void> {
  await CONFIG_REF.set({ allocationMode: mode }, { merge: true });
}
