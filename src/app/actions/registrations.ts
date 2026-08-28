"use server";

import { revalidatePath } from "next/cache";
import { requireParticipant } from "@/lib/auth/guards";
import { registrationSubmitSchema } from "@/types/registration";
import { submitRegistration } from "@/lib/firestore/registrations";
import { getEventConfig } from "@/lib/firestore/event-config";

export interface SubmitState {
  error?: string;
  success?: boolean;
  status?: "confirmed" | "waitlisted";
}

export async function submitPreferences(
  _prevState: SubmitState,
  formData: FormData
): Promise<SubmitState> {
  const { participantId } = await requireParticipant();

  const config = await getEventConfig();
  if (!config.registrationOpen) {
    return { error: "Die Anmeldephase ist bereits beendet. Es sind keine Änderungen mehr möglich." };
  }

  const parsed = registrationSubmitSchema.safeParse({
    preferences: formData.getAll("preferences").map(String),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }

  try {
    const result = await submitRegistration(participantId, parsed.data);
    revalidatePath("/workshops");
    revalidatePath("/result");
    return { success: true, status: result.status };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unbekannter Fehler." };
  }
}
