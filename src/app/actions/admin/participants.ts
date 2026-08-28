"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { parseParticipantsCsv, type ParsedImport } from "@/lib/import/csv-parser";
import {
  existingEmails,
  importParticipants,
  regenerateAccessCode,
} from "@/lib/firestore/participants";
import {
  cancelRegistration,
  getRegistration,
  manuallyAssignFromWaitlist,
  reassignWaitlistedParticipants,
  submitRegistration,
  type ReassignSummary,
} from "@/lib/firestore/registrations";
import type { ParticipantImportRow } from "@/types/participant";

export async function previewParticipantImport(csvContent: string): Promise<ParsedImport> {
  await requireAdmin();
  const existing = await existingEmails();
  return parseParticipantsCsv(csvContent, existing);
}

export async function confirmParticipantImport(
  rows: ParticipantImportRow[]
): Promise<{ importedCount: number }> {
  await requireAdmin();
  if (rows.length === 0) return { importedCount: 0 };
  const results = await importParticipants(rows);
  revalidatePath("/admin/participants");
  return { importedCount: results.length };
}

/** Erzeugt einen neuen Zugangscode fuer einen Teilnehmer (z.B. bei verlorenem Code)
 * und setzt ihn fuer den naechsten Export wieder auf "nicht exportiert". */
export async function regenerateParticipantAccessCode(participantId: string): Promise<void> {
  await requireAdmin();
  await regenerateAccessCode(participantId);
  revalidatePath("/admin/participants");
}

/** Storniert die Anmeldung eines Teilnehmers (z.B. krankheitsbedingter Ausfall) und
 * gibt seine reservierte(n) Workshop-Kapazitaet(en) wieder frei. */
export async function cancelParticipantRegistration(participantId: string): Promise<void> {
  await requireAdmin();
  await cancelRegistration(participantId);
  revalidatePath("/admin/participants");
}

/** Versucht erneut, einen wartenden Teilnehmer mit seinen bereits hinterlegten
 * Praeferenzen zu buchen (z.B. nachdem durch eine Stornierung Kapazitaet frei
 * wurde). Gibt zurueck, ob es diesmal geklappt hat. */
export async function retryWaitlistedParticipant(
  participantId: string
): Promise<{ confirmed: boolean; error?: string }> {
  await requireAdmin();
  const registration = await getRegistration(participantId);
  if (!registration) {
    return { confirmed: false, error: "Keine Anmeldung gefunden." };
  }
  try {
    const result = await submitRegistration(participantId, { preferences: registration.preferences });
    revalidatePath("/admin/participants");
    return { confirmed: result.status === "confirmed" };
  } catch (err) {
    return { confirmed: false, error: err instanceof Error ? err.message : "Unbekannter Fehler." };
  }
}

/** Rueckt alle wartenden Teilnehmer nach, fuer die zwischenzeitlich Kapazitaet frei
 * wurde (z.B. nach einer Stornierung) - in der Reihenfolge/Gewichtung des aktuell
 * eingestellten Zuteilungsmodus. Bereits bestaetigte Teilnehmer bleiben unangetastet. */
export async function reassignWaitlistAction(): Promise<ReassignSummary> {
  await requireAdmin();
  const summary = await reassignWaitlistedParticipants();
  revalidatePath("/admin/participants");
  return summary;
}

/** Admin-Override: weist einen bestimmten wartenden Teilnehmer manuell einem Buendel
 * zu, unabhaengig von seinen urspruenglichen Praeferenzen. */
export async function manuallyAssignWaitlistedAction(
  participantId: string,
  workshopIds: string[]
): Promise<{ error?: string }> {
  await requireAdmin();
  const result = await manuallyAssignFromWaitlist(participantId, workshopIds);
  if (!result.error) revalidatePath("/admin/participants");
  return result;
}
