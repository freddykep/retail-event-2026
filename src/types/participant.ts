import { z } from "zod";

export type RegistrationStatus =
  | "imported"
  | "not_registered"
  | "registered"
  | "assigned"
  | "waitlisted";

export interface ParticipantDoc {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Fuer die Login-Suche (Firestore-Query per Gleichheit). */
  accessCodeHash: string;
  /** AES-256-GCM-verschluesselt, nur fuer den XLSX-Export wieder entschluesselbar. */
  accessCodeEncrypted: string;
  createdAt: number;
  /** War der Teilnehmer bereits in einem XLSX-Einladungsexport enthalten? */
  exported: boolean;
  exportedAt: number | null;
  registrationStatus: RegistrationStatus;
}

export const participantImportRowSchema = z.object({
  firstName: z.string().trim().min(1, "Vorname fehlt"),
  lastName: z.string().trim().min(1, "Nachname fehlt"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Ungueltige E-Mail-Adresse")),
});

export type ParticipantImportRow = z.infer<typeof participantImportRowSchema>;

export interface ImportRowResult {
  row: number;
  data: Partial<ParticipantImportRow>;
  errors: string[];
  valid: boolean;
}

export function participantDisplayName(p: Pick<ParticipantDoc, "firstName" | "lastName">) {
  return `${p.firstName} ${p.lastName}`;
}
