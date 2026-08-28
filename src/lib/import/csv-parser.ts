import Papa from "papaparse";
import { participantImportRowSchema, type ImportRowResult } from "@/types/participant";

const HEADER_ALIASES: Record<string, "firstName" | "lastName" | "email"> = {
  vorname: "firstName",
  firstname: "firstName",
  "first name": "firstName",
  nachname: "lastName",
  lastname: "lastName",
  "last name": "lastName",
  "e-mail": "email",
  email: "email",
  "e-mail-adresse": "email",
  mail: "email",
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

export interface ParsedImport {
  rows: ImportRowResult[];
  validCount: number;
  errorCount: number;
  duplicateEmailsInFile: string[];
}

/**
 * Parst eine CSV-Datei mit Teilnehmerdaten (Vorname/Nachname/E-Mail, deutsche oder
 * englische Spaltennamen) und validiert jede Zeile. `existingEmails` enthaelt bereits
 * importierte E-Mail-Adressen (kleingeschrieben) zur Duplikatpruefung.
 */
export function parseParticipantsCsv(csvContent: string, existingEmails: Set<string>): ParsedImport {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => HEADER_ALIASES[normalizeHeader(header)] ?? normalizeHeader(header),
  });

  const seenInFile = new Map<string, number>();
  const duplicateEmailsInFile: string[] = [];
  const rows: ImportRowResult[] = [];

  parsed.data.forEach((raw, index) => {
    const rowNumber = index + 2; // 1-basiert + Headerzeile
    const candidate = {
      firstName: raw.firstName ?? "",
      lastName: raw.lastName ?? "",
      email: raw.email ?? "",
    };

    const result = participantImportRowSchema.safeParse(candidate);
    if (!result.success) {
      rows.push({
        row: rowNumber,
        data: candidate,
        errors: result.error.issues.map((i) => i.message),
        valid: false,
      });
      return;
    }

    const email = result.data.email;
    const errors: string[] = [];

    if (existingEmails.has(email)) {
      errors.push("E-Mail-Adresse ist bereits als Teilnehmer vorhanden");
    }
    if (seenInFile.has(email)) {
      errors.push("Doppelte E-Mail-Adresse innerhalb der Datei");
      duplicateEmailsInFile.push(email);
    }
    seenInFile.set(email, rowNumber);

    rows.push({ row: rowNumber, data: result.data, errors, valid: errors.length === 0 });
  });

  return {
    rows,
    validCount: rows.filter((r) => r.valid).length,
    errorCount: rows.filter((r) => !r.valid).length,
    duplicateEmailsInFile,
  };
}
