"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import {
  generateDraftAllocation,
  publishAssignments,
  removeDraftAssignment,
  updateDraftAssignment,
} from "@/lib/firestore/assignments";
import { setAllocationMode, setRegistrationOpen } from "@/lib/firestore/event-config";
import type { AllocationMode } from "@/types/assignment";

export async function generateDraftAllocationAction() {
  await requireAdmin();
  const summary = await generateDraftAllocation();
  revalidatePath("/admin/allocation");
  return summary;
}

export async function updateDraftAssignmentAction(
  participantId: string,
  workshopIds: string[]
): Promise<{ error?: string }> {
  await requireAdmin();
  try {
    await updateDraftAssignment(participantId, workshopIds);
    revalidatePath("/admin/allocation");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Änderung fehlgeschlagen." };
  }
}

export async function removeDraftAssignmentAction(participantId: string): Promise<void> {
  await requireAdmin();
  await removeDraftAssignment(participantId);
  revalidatePath("/admin/allocation");
}

export async function publishAssignmentsAction() {
  await requireAdmin();
  const result = await publishAssignments();
  revalidatePath("/admin/allocation");
  revalidatePath("/result");
  return result;
}

export async function setRegistrationOpenAction(open: boolean): Promise<void> {
  await requireAdmin();
  await setRegistrationOpen(open);
  revalidatePath("/admin");
  revalidatePath("/workshops");
}

export async function setAllocationModeAction(mode: AllocationMode): Promise<void> {
  await requireAdmin();
  await setAllocationMode(mode);
  revalidatePath("/admin/allocation");
}
