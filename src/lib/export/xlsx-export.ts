import * as XLSX from "xlsx";

export interface InvitationRow {
  firstName: string;
  lastName: string;
  email: string;
  accessCode: string;
}

/**
 * Baut die XLSX-Datei fuer den Outlook/Word-Seriendruck. Spalten sind bewusst
 * einfache, sprechende Feldnamen (Vorname/Nachname/E-Mail/Zugangscode/Anmeldelink),
 * damit sie direkt als Seriendruckfelder uebernommen werden koennen. Der Anmeldelink
 * ist fuer alle Zeilen identisch (nicht personalisiert) - die Zuordnung erfolgt
 * ausschliesslich ueber den individuellen Zugangscode.
 */
export function buildInvitationsXlsx(rows: InvitationRow[], appUrl: string): Buffer {
  const data = rows.map((r) => ({
    Vorname: r.firstName,
    Nachname: r.lastName,
    "E-Mail": r.email,
    Zugangscode: r.accessCode,
    Anmeldelink: appUrl,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 36 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Einladungen");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
