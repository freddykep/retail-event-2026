"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { parseParticipantsCsv, type ParsedImport } from "@/lib/import/csv-parser";
import {
  existingEmails,
  importParticipants,
  regenerateAccessCode,
} from "@/lib/firestore/participants";
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
