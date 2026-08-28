"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { workshopInputSchema } from "@/types/workshop";
import { createWorkshop, deleteWorkshop, updateWorkshop } from "@/lib/firestore/workshops";
import { findWorkshopImage } from "@/lib/workshop-images";

export interface WorkshopFormState {
  error?: string;
  success?: boolean;
}

function parseWorkshopForm(formData: FormData) {
  const durationMinutes = Number(formData.get("durationMinutes"));
  const sessionRaw = formData.get("session");
  const session =
    durationMinutes === 60 ? (sessionRaw === "both" ? "both" : sessionRaw ? Number(sessionRaw) : null) : null;
  return workshopInputSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    durationMinutes,
    session,
    capacity: Number(formData.get("capacity")),
    room: String(formData.get("room") ?? ""),
    speaker: String(formData.get("speaker") ?? ""),
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });
}

function imageUrlFromForm(formData: FormData): string | null {
  const imageId = formData.get("imageId");
  return findWorkshopImage(typeof imageId === "string" ? imageId : null)?.path ?? null;
}

export async function createWorkshopAction(
  _prevState: WorkshopFormState,
  formData: FormData
): Promise<WorkshopFormState> {
  await requireAdmin();
  const parsed = parseWorkshopForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }

  const workshop = await createWorkshop(parsed.data);
  const imageUrl = imageUrlFromForm(formData);
  if (imageUrl) {
    await updateWorkshop(workshop.id, { imageUrl });
  }

  revalidatePath("/admin/workshops");
  return { success: true };
}

export async function updateWorkshopAction(
  workshopId: string,
  _prevState: WorkshopFormState,
  formData: FormData
): Promise<WorkshopFormState> {
  await requireAdmin();
  const parsed = parseWorkshopForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }

  await updateWorkshop(workshopId, { ...parsed.data, imageUrl: imageUrlFromForm(formData) });

  revalidatePath("/admin/workshops");
  return { success: true };
}

export async function deleteWorkshopAction(workshopId: string): Promise<{ error?: string }> {
  await requireAdmin();
  try {
    await deleteWorkshop(workshopId);
    revalidatePath("/admin/workshops");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Löschen fehlgeschlagen." };
  }
}
